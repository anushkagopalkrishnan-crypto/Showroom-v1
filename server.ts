import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Check your Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('high demand') ||
    raw.includes('429') ||
    raw.includes('RESOURCE_EXHAUSTED')
  );
}

async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
  }
) {
  const delays = [600, 1400];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (err) {
      lastError = err;
      if (!isTransientError(err) || attempt === delays.length) {
        break;
      }
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }

  // Fallback to gemini-3.1-flash-lite if gemini-4-hydrogen is temporarily unavailable (503)
  if (isTransientError(lastError)) {
    return await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: params.contents,
      config: {
        systemInstruction: params.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: params.responseSchema,
      },
    });
  }

  throw lastError;
}

function extractApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  let parsedMsg = raw;
  try {
    const obj = JSON.parse(raw) as { error?: { message?: string } };
    if (obj?.error?.message) {
      parsedMsg = obj.error.message;
    }
  } catch {
    // not JSON
  }

  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message:
        'Gemini API key permission error. Please verify your API key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message:
        'Gemini is temporarily experiencing high demand. Please retry in a few seconds.',
    };
  }
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: raw };
  }
  return {
    status: 500,
    message: parsedMsg || 'Unexpected server error calling Gemini API.',
  };
}

const sceneSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: 'Unique scene ID like scene-1' },
    type: {
      type: Type.STRING,
      description:
        'Must be one of: title_card, what_we_heard, conversation, capability_callout, closing_card',
    },
    title: { type: Type.STRING, description: 'Short descriptive card title' },
    durationSeconds: {
      type: Type.INTEGER,
      description: 'Duration of this scene in seconds (integer between 6 and 25)',
    },
    narrationText: {
      type: Type.STRING,
      description: 'Spoken narration for this scene. Strictly 40 words or fewer.',
    },
    onScreenContent: {
      type: Type.OBJECT,
      description: 'Structured visual content rendered inside the 16:9 scene',
      properties: {
        headline: {
          type: Type.STRING,
          description: 'Used on title_card: Prepared for [prospect name]',
        },
        subtitle: {
          type: Type.STRING,
          description: 'Used on title_card: one line on what the video covers',
        },
        heading: {
          type: Type.STRING,
          description: 'Heading for what_we_heard or closing_card',
        },
        quotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Used on what_we_heard: exactly 3 short quotes from discovery notes',
        },
        articleTitle: {
          type: Type.STRING,
          description: 'Used on conversation: exact help article title used for the answer',
        },
        messages: {
          type: Type.ARRAY,
          description: 'Used on conversation: alternating customer and agent chat turns',
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: {
                type: Type.STRING,
                description: 'Either "customer" or "agent"',
              },
              text: { type: Type.STRING },
            },
            required: ['speaker', 'text'],
          },
        },
        handover: {
          type: Type.OBJECT,
          description:
            'Optional on conversation, required on at least one conversation scene: handover summary to human agent',
          properties: {
            reason: { type: Type.STRING },
            collectedFields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                },
                required: ['label', 'value'],
              },
            },
          },
        },
        discoveryQuote: {
          type: Type.STRING,
          description: 'Used on capability_callout: exact need quote from discovery notes',
        },
        capabilityItem: {
          type: Type.STRING,
          description: 'Used on capability_callout: exact matching item from capabilities list',
        },
        explanation: {
          type: Type.STRING,
          description: 'Used on capability_callout: concise grounded link between need and capability',
        },
        nextSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Used on closing_card: 2-3 suggested next steps such as a technical session',
        },
      },
    },
  },
  required: ['id', 'type', 'title', 'durationSeconds', 'narrationText', 'onScreenContent'],
};

function sanitizeScene(raw: Record<string, unknown>, fallbackId: string) {
  const allowedTypes = new Set([
    'title_card',
    'what_we_heard',
    'conversation',
    'capability_callout',
    'closing_card',
  ]);
  const type = allowedTypes.has(String(raw.type))
    ? (String(raw.type) as
        | 'title_card'
        | 'what_we_heard'
        | 'conversation'
        | 'capability_callout'
        | 'closing_card')
    : 'title_card';

  const durationRaw = Number(raw.durationSeconds);
  const durationSeconds = Number.isFinite(durationRaw)
    ? Math.max(6, Math.min(25, Math.round(durationRaw)))
    : 12;

  const narrationText = String(raw.narrationText ?? '').trim();
  const content = (raw.onScreenContent ?? {}) as Record<string, unknown>;

  return {
    id: String(raw.id || fallbackId),
    type,
    title: String(raw.title || 'Scene'),
    durationSeconds,
    narrationText,
    onScreenContent: content,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.post('/api/showroom/build-storyboard', async (req: Request, res: Response) => {
    try {
      const {
        prospectName,
        industry,
        helpContent,
        discoveryNotes,
        capabilities,
        targetLength,
      } = req.body ?? {};

      if (
        !prospectName?.trim() ||
        !industry?.trim() ||
        !helpContent?.trim() ||
        !discoveryNotes?.trim() ||
        !capabilities?.trim()
      ) {
        res.status(400).json({
          error: 'All setup fields are required before building a storyboard.',
        });
        return;
      }

      const ai = getAiClient();
      const target = [60, 90, 120].includes(Number(targetLength))
        ? Number(targetLength)
        : 90;

      const systemInstruction = `You are Showroom, an internal enterprise demo producer.
STRICT GROUNDING RULES:
1. NEVER invent facts, metrics, capabilities, help policies, or customer details. Every single claim, quote, policy, and capability in the brief and storyboard MUST come strictly from the provided Help Content, Discovery Notes, or Our Capabilities list.
2. NEVER include anything the buyer asked to skip in the Discovery Notes. List everything left out in "notIncluded" and in "brief.skippedItems" with the exact quote from the Discovery Notes.
3. Conversation scenes MUST draw customer questions from the top contact reasons and answer using ONLY the Help Content, citing the exact help article title in onScreenContent.articleTitle.
4. Conversation answers MUST NOT include account-specific details such as account balances, card numbers, account numbers, SSNs, or personal financial records.
5. At least one conversation scene MUST end with a handover to a human agent (onScreenContent.handover), showing the non-sensitive triage details the AI agent already collected (e.g., merchant name, date, card possession status, intent).
6. For capability_callout scenes: match ONE need from the discovery notes to ONE explicit item from Our Capabilities. If nothing in Our Capabilities genuinely matches a discovery need, DO NOT create a capability_callout scene.
7. Every scene's narrationText MUST be 40 words or fewer. Aim for natural, concise spoken phrasing.
8. Generate 6 to 8 ordered scenes whose durationSeconds sum closely to ${target} seconds.
   Required arc:
   - Scene 1: title_card ("Prepared for ${prospectName}" + one line on what the video covers)
   - Scene 2: what_we_heard (3 needs from discovery notes as short quotes)
   - Scenes 3..5: 2 or 3 conversation scenes (with at least 1 having handover)
   - Optional capability_callout scene(s) only when a real match exists
   - Final scene: closing_card (suggested next steps, e.g. technical session)`;

      const prompt = `Prospect Name: ${prospectName}
Industry: ${industry}
Target Video Length: ${target} seconds

--- HELP CONTENT ---
${helpContent}

--- DISCOVERY NOTES ---
${discoveryNotes}

--- OUR CAPABILITIES ---
${capabilities}`;

      const response = await generateWithFallback(ai, {
        contents: prompt,
        systemInstruction,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brief: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description:
                    'Two-sentence summary of who the prospect is and who their customers are.',
                },
                topContactReasons: {
                  type: Type.ARRAY,
                  description:
                    'Top 5 reasons customers contact them, each with the source help article title.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      reason: { type: Type.STRING },
                      articleTitle: { type: Type.STRING },
                    },
                    required: ['reason', 'articleTitle'],
                  },
                },
                skippedItems: {
                  type: Type.ARRAY,
                  description:
                    'Topics the buyer asked to skip, each with the exact quote from discovery notes.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic: { type: Type.STRING },
                      quote: { type: Type.STRING },
                    },
                    required: ['topic', 'quote'],
                  },
                },
              },
              required: ['summary', 'topContactReasons', 'skippedItems'],
            },
            notIncluded: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                'Concise list of skipped topics/items intentionally left out of the video for the salesperson note.',
            },
            scenes: {
              type: Type.ARRAY,
              items: sceneSchema,
            },
          },
          required: ['brief', 'notIncluded', 'scenes'],
        },
      });

      const parsed = JSON.parse(response.text ?? '{}') as {
        brief?: {
          summary?: string;
          topContactReasons?: Array<{ reason: string; articleTitle: string }>;
          skippedItems?: Array<{ topic: string; quote: string }>;
        };
        notIncluded?: string[];
        scenes?: Array<Record<string, unknown>>;
      };

      const scenes = (parsed.scenes ?? []).map((scene, idx) =>
        sanitizeScene(scene, `scene-${idx + 1}-${Date.now()}`)
      );

      res.json({
        brief: {
          summary: parsed.brief?.summary ?? '',
          topContactReasons: (parsed.brief?.topContactReasons ?? []).slice(0, 5),
          skippedItems: parsed.brief?.skippedItems ?? [],
        },
        notIncluded: parsed.notIncluded ?? [],
        scenes,
      });
    } catch (err) {
      const { status, message } = extractApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/showroom/regenerate-scene', async (req: Request, res: Response) => {
    try {
      const { setup, currentScene, sceneIndex, totalScenes } = req.body ?? {};
      if (!setup || !currentScene) {
        res.status(400).json({ error: 'Setup context and target scene are required.' });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `You are regenerating ONE scene (position ${Number(sceneIndex) + 1} of ${totalScenes}) in a Showroom personalized demo storyboard.
STRICT RULES:
1. Keep the same scene type ("${currentScene.type}") unless regenerating a capability_callout that has no valid match.
2. NEVER invent facts. Use ONLY Help Content, Discovery Notes, and Our Capabilities.
3. Exclude anything the buyer asked to skip in Discovery Notes.
4. Conversation answers MUST NOT contain account-specific details (no balances, card numbers, account IDs).
5. If this is a conversation scene and currentScene had a handover, preserve a handover to a human agent with collected non-sensitive details.
6. narrationText MUST be 40 words or fewer.
7. Provide a fresh variation on wording/angle while staying strictly grounded.`;

      const prompt = `Prospect: ${setup.prospectName} (${setup.industry})
Target scene to regenerate:
${JSON.stringify(currentScene, null, 2)}

--- HELP CONTENT ---
${setup.helpContent}

--- DISCOVERY NOTES ---
${setup.discoveryNotes}

--- OUR CAPABILITIES ---
${setup.capabilities}`;

      const response = await generateWithFallback(ai, {
        contents: prompt,
        systemInstruction,
        responseSchema: sceneSchema,
      });

      const parsed = JSON.parse(response.text ?? '{}') as Record<string, unknown>;
      const regenerated = sanitizeScene(
        parsed,
        String(currentScene.id || `scene-${Date.now()}`)
      );
      regenerated.id = String(currentScene.id || regenerated.id);

      res.json({ scene: regenerated });
    } catch (err) {
      const { status, message } = extractApiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/showroom/tts', async (req: Request, res: Response) => {
    try {
      const { text } = req.body ?? {};
      const cleanText = String(text ?? '').trim();
      if (!cleanText) {
        res.status(400).json({ error: 'Narration text is required for TTS.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: 'Warm, clear, confident product presenter',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        res.json({
          fallback: true,
          error: 'TTS returned no audio data; using browser speech synthesis.',
        });
        return;
      }

      res.json({
        fallback: false,
        mimeType,
        audioBase64: base64Audio,
      });
    } catch (err) {
      const { message } = extractApiError(err);
      // Gracefully indicate fallback so Video playback automatically uses browser speechSynthesis
      res.json({
        fallback: true,
        error: message,
      });
    }
  });

  app.post('/api/showroom/analyze-followup', async (req: Request, res: Response) => {
    try {
      const { prospectName, industry, capabilities, transcript } = req.body ?? {};
      if (!transcript?.trim()) {
        res.status(400).json({
          error: 'Paste or upload a buyer reply or call transcript first.',
        });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `You are a sales operations assistant preparing post-demo follow-up actions and a buyer email.
STRICT RULES:
1. Extract ONLY explicit requests the buyer made OR explicit commitments our team made in the transcript. Do NOT include general discussion points, praise, or pleasantries.
2. For each request:
   - "request": clear summary of the ask or commitment
   - "askedByRole": role of the person who asked or committed (e.g., "VP Member Experience", "Contact Center Director", "Solutions Engineer")
   - "exactQuote": verbatim quote from the transcript
   - "suggestedOwner": responsible internal role such as "Account Executive", "Solutions Engineer", "Implementation Lead", or "Legal"
   - "dueDate": exact due date/timeframe if stated in the transcript (e.g. "this Friday", "next Wednesday"), otherwise literally "not stated"
3. Draft a concise, clear follow-up email ("draftEmailSubject" and "draftEmailBody") to the buyer listing each request and what happens next. Format draftEmailBody with proper email line breaks (\\n\\n between paragraphs and each request on its own numbered line with \\n, never a single wall-of-text paragraph).
4. CRITICAL: Never invent answers, numbers, SLAs, integrations, or pricing. Wherever we do not yet have the answer from the transcript or Our Capabilities list, insert a clearly marked bracketed placeholder such as [ANSWER NEEDED: pricing breakdown] or [ANSWER NEEDED: Symitar core connector support].`;

      const prompt = `Prospect: ${prospectName || 'Prospect'} (${industry || 'Enterprise'})

--- OUR CAPABILITIES ---
${capabilities || 'Not provided'}

--- BUYER REPLY / CALL TRANSCRIPT ---
${transcript}`;

      const response = await generateWithFallback(ai, {
        contents: prompt,
        systemInstruction,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            requests: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  request: { type: Type.STRING },
                  askedByRole: { type: Type.STRING },
                  exactQuote: { type: Type.STRING },
                  suggestedOwner: { type: Type.STRING },
                  dueDate: { type: Type.STRING },
                },
                required: [
                  'id',
                  'request',
                  'askedByRole',
                  'exactQuote',
                  'suggestedOwner',
                  'dueDate',
                ],
              },
            },
            draftEmailSubject: { type: Type.STRING },
            draftEmailBody: { type: Type.STRING },
          },
          required: ['requests', 'draftEmailSubject', 'draftEmailBody'],
        },
      });

      const parsed = JSON.parse(response.text ?? '{}') as {
        requests?: Array<Record<string, unknown>>;
        draftEmailSubject?: string;
        draftEmailBody?: string;
      };

      const requests = (parsed.requests ?? []).map((item, index) => ({
        id: String(item.id || `req-${index + 1}`),
        request: String(item.request || ''),
        askedByRole: String(item.askedByRole || 'Buyer'),
        exactQuote: String(item.exactQuote || ''),
        suggestedOwner: String(item.suggestedOwner || 'Account Executive'),
        dueDate: String(item.dueDate || 'not stated').trim() || 'not stated',
        status: 'Open' as const,
      }));

      res.json({
        requests,
        draftEmailSubject: String(
          parsed.draftEmailSubject || `Follow-up: ${prospectName || 'Demo'} next steps`
        ),
        draftEmailBody: String(parsed.draftEmailBody || ''),
      });
    } catch (err) {
      const { status, message } = extractApiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Showroom server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Showroom server:', err);
  process.exit(1);
});
