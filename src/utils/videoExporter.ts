import type { StoryboardScene } from '../types/showroom';
import {
  computeTimeline,
  getChatBubbleProgress,
  getContrastTextColor,
  getPlaybackPosition,
  getStaggeredRevealCount,
  mixHexColor,
  normalizeHexColor,
} from './showroomLogic';

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

export interface ExportSceneAudio {
  buffer: ArrayBuffer;
}

export async function exportStoryboardWebm(options: {
  scenes: StoryboardScene[];
  brandColor: string;
  prospectName: string;
  audioBySceneKey: Map<string, ArrayBuffer>;
  onProgress?: (percent: number) => void;
}): Promise<Blob> {
  const { scenes, brandColor, audioBySceneKey, onProgress } = options;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video export requires MediaRecorder support in this browser.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2D canvas for video export.');

  const timeline = computeTimeline(scenes);
  const totalSeconds = timeline.totalDuration;
  if (totalSeconds <= 0) {
    throw new Error('Storyboard has no playable duration.');
  }

  const brand = normalizeHexColor(brandColor);
  const contrastInk = getContrastTextColor(brand);
  const deepBrand = mixHexColor(brand, '#0F172A', 0.38);
  const softBrand = mixHexColor(brand, '#FFFFFF', 0.92);

  const canvasStream = canvas.captureStream(30);
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

  let audioCtx: AudioContext | null = null;
  const scheduledSources: AudioBufferSourceNode[] = [];

  try {
    if (audioBySceneKey.size > 0 && typeof AudioContext !== 'undefined') {
      audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      for (const seg of timeline.segments) {
        const scene = scenes[seg.index];
        const key = `${scene.id}::${scene.narrationText}`;
        const raw = audioBySceneKey.get(key);
        if (raw) {
          const decoded = await audioCtx.decodeAudioData(raw.slice(0));
          const source = audioCtx.createBufferSource();
          source.buffer = decoded;
          source.connect(dest);
          source.start(audioCtx.currentTime + seg.start);
          scheduledSources.push(source);
        }
      }
      tracks.push(...dest.stream.getAudioTracks());
    }
  } catch {
    // Proceed with video-only export if audio decoding fails
  }

  const combinedStream = new MediaStream(tracks);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const renderFrame = (elapsed: number) => {
    const pos = getPlaybackPosition(timeline, elapsed);
    const scene = scenes[pos.sceneIndex];
    const progress = pos.sceneProgress;
    const c = scene.onScreenContent;

    ctx.clearRect(0, 0, 1280, 720);

    // Background per scene type
    if (scene.type === 'title_card' || scene.type === 'closing_card') {
      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, brand);
      grad.addColorStop(1, deepBrand);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      const alpha = Math.min(1, progress * 3.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = contrastInk;

      if (scene.type === 'title_card') {
        ctx.font = '700 54px "Plus Jakarta Sans", sans-serif';
        const lines = wrapTextLines(ctx, c.headline || scene.title, 1000);
        lines.forEach((line, i) => {
          ctx.fillText(line, 110, 290 + i * 68);
        });
        ctx.font = '400 26px "DM Sans", sans-serif';
        ctx.globalAlpha = alpha * 0.88;
        const subLines = wrapTextLines(ctx, c.subtitle || '', 960);
        subLines.forEach((line, i) => {
          ctx.fillText(line, 110, 380 + lines.length * 40 + i * 36);
        });
      } else {
        ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(c.heading || 'Suggested next steps', 110, 220);
        ctx.font = '400 24px "DM Sans", sans-serif';
        (c.nextSteps ?? []).forEach((step, idx) => {
          ctx.fillText(`•  ${step}`, 110, 300 + idx * 48);
        });
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, 1280, 720);

      // Top accent bar
      ctx.fillStyle = brand;
      ctx.fillRect(0, 0, 1280, 8);

      if (scene.type === 'what_we_heard') {
        ctx.fillStyle = '#0F172A';
        ctx.font = '700 38px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(c.heading || 'What we heard', 96, 120);

        const quotes = c.quotes ?? [];
        const visible = getStaggeredRevealCount(progress, quotes.length);
        let y = 185;
        for (let i = 0; i < visible; i++) {
          ctx.fillStyle = '#FFFFFF';
          drawRoundedRect(ctx, 96, y, 1088, 108, 10);
          ctx.fill();
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#0F172A';
          ctx.font = '500 22px "DM Sans", sans-serif';
          const qLines = wrapTextLines(ctx, `“${quotes[i]}”`, 1020);
          qLines.slice(0, 2).forEach((line, li) => {
            ctx.fillText(line, 126, y + 46 + li * 30);
          });
          y += 128;
        }
      } else if (scene.type === 'conversation') {
        ctx.fillStyle = softBrand;
        ctx.fillRect(0, 8, 1280, 70);
        ctx.fillStyle = '#0F172A';
        ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `Grounded in: ${c.articleTitle || 'Help Center'}`,
          72,
          52
        );

        const messages = c.messages ?? [];
        const chatState = getChatBubbleProgress(
          progress,
          messages.length,
          Boolean(c.handover)
        );
        let y = 110;
        for (let i = 0; i < chatState.visibleCount; i++) {
          const msg = messages[i];
          const isTyping = i === chatState.activeTypingIndex;
          const displayText = isTyping
            ? msg.text.slice(0, Math.max(1, Math.ceil(msg.text.length * chatState.activeCharRatio)))
            : msg.text;
          const isCustomer = msg.speaker === 'customer';
          const boxW = 760;
          const boxX = isCustomer ? 72 : 1280 - 72 - boxW;
          ctx.font = '400 20px "DM Sans", sans-serif';
          const lines = wrapTextLines(ctx, displayText, boxW - 44).slice(0, 3);
          const boxH = 34 + lines.length * 28;

          ctx.fillStyle = isCustomer ? '#FFFFFF' : brand;
          drawRoundedRect(ctx, boxX, y, boxW, boxH, 12);
          ctx.fill();
          if (isCustomer) {
            ctx.strokeStyle = '#CBD5E1';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          ctx.fillStyle = isCustomer ? '#0F172A' : contrastInk;
          lines.forEach((line, li) => {
            ctx.fillText(line, boxX + 22, y + 32 + li * 28);
          });
          y += boxH + 16;
        }

        if (chatState.showHandover && c.handover) {
          ctx.fillStyle = '#FFFFFF';
          drawRoundedRect(ctx, 72, Math.min(480, y + 6), 1136, 108, 10);
          ctx.fill();
          ctx.strokeStyle = brand;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#0F172A';
          ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(
            `Handed over to human agent — ${c.handover.reason}`,
            96,
            Math.min(480, y + 6) + 36
          );
          ctx.font = '400 17px "DM Sans", sans-serif';
          const summary = c.handover.collectedFields
            .map((f) => `${f.label}: ${f.value}`)
            .join('   ·   ');
          ctx.fillText(summary, 96, Math.min(480, y + 6) + 72);
        }
      } else if (scene.type === 'capability_callout') {
        ctx.fillStyle = '#0F172A';
        ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Matched capability', 96, 120);

        ctx.fillStyle = '#FFFFFF';
        drawRoundedRect(ctx, 96, 175, 510, 340, 12);
        ctx.fill();
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('What you shared', 128, 220);
        ctx.fillStyle = '#0F172A';
        ctx.font = '400 22px "DM Sans", sans-serif';
        wrapTextLines(ctx, `“${c.discoveryQuote || ''}”`, 445).forEach((l, i) => {
          ctx.fillText(l, 128, 265 + i * 32);
        });

        ctx.fillStyle = brand;
        drawRoundedRect(ctx, 646, 175, 538, 340, 12);
        ctx.fill();
        ctx.fillStyle = contrastInk;
        ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
        wrapTextLines(ctx, c.capabilityItem || '', 470).forEach((l, i) => {
          ctx.fillText(l, 678, 230 + i * 32);
        });
        ctx.font = '400 19px "DM Sans", sans-serif';
        wrapTextLines(ctx, c.explanation || '', 470).forEach((l, i) => {
          ctx.fillText(l, 678, 320 + i * 28);
        });
      }
    }

    // Watermark on every scene
    ctx.save();
    ctx.fillStyle =
      scene.type === 'title_card' || scene.type === 'closing_card'
        ? contrastInk
        : '#334155';
    ctx.globalAlpha = 0.72;
    ctx.font = '500 15px "DM Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Draft for internal review', 1244, 42);
    ctx.restore();

    // Captions bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.fillRect(0, 622, 1280, 98);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '400 21px "DM Sans", sans-serif';
    const capLines = wrapTextLines(ctx, scene.narrationText, 1120).slice(0, 2);
    capLines.forEach((line, idx) => {
      ctx.fillText(line, 80, 662 + idx * 30);
    });
  };

  return await new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Video recording failed.'));
    recorder.onstop = () => {
      scheduledSources.forEach((s) => {
        try {
          s.stop();
        } catch {
          // ignore
        }
      });
      if (audioCtx) {
        audioCtx.close().catch(() => undefined);
      }
      resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.start(200);
    const startMs = performance.now();

    const step = () => {
      const elapsed = (performance.now() - startMs) / 1000;
      renderFrame(Math.min(elapsed, totalSeconds));
      if (onProgress) {
        onProgress(Math.min(100, Math.round((elapsed / totalSeconds) * 100)));
      }
      if (elapsed >= totalSeconds) {
        recorder.stop();
        return;
      }
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}
