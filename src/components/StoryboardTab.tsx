import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { StoryboardScene, TargetLength } from '../types/showroom';
import {
  computeTimeline,
  countWords,
  getSceneTypeLabel,
  isNarrationWithinLimit,
  MAX_NARRATION_WORDS,
} from '../utils/showroomLogic';

interface StoryboardTabProps {
  scenes: StoryboardScene[];
  notIncluded: string[];
  targetLength: TargetLength;
  onUpdateScene: (sceneId: string, patch: Partial<StoryboardScene>) => void;
  onMoveScene: (fromIndex: number, toIndex: number) => void;
  onDeleteScene: (sceneId: string) => void;
  onRegenerateScene: (sceneId: string) => Promise<void>;
  onGoToSetup: () => void;
  onGoToVideo: () => void;
}

export function StoryboardTab({
  scenes,
  notIncluded,
  targetLength,
  onUpdateScene,
  onMoveScene,
  onDeleteScene,
  onRegenerateScene,
  onGoToSetup,
  onGoToVideo,
}: StoryboardTabProps) {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  if (scenes.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          No storyboard built yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Complete the Prospect setup inputs and select Build storyboard to
          generate scenes grounded in your help content and discovery notes.
        </p>
        <button
          type="button"
          onClick={onGoToSetup}
          className="mt-5 inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
        >
          Go to Setup
        </button>
      </div>
    );
  }

  const timeline = computeTimeline(scenes);

  const handleRegenerate = async (sceneId: string) => {
    setRegenError(null);
    setRegeneratingId(sceneId);
    try {
      await onRegenerateScene(sceneId);
    } catch (err) {
      setRegenError(
        err instanceof Error ? err.message : 'Failed to regenerate scene.'
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Storyboard
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
            <span>{scenes.length} scenes</span>
            <span aria-hidden="true">·</span>
            <span>
              {timeline.totalDuration}s total / {targetLength}s target
            </span>
            <span aria-hidden="true">·</span>
            <span>Narration limit {MAX_NARRATION_WORDS} words per scene</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToVideo}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 whitespace-nowrap shrink-0"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          Preview Video
        </button>
      </div>

      {notIncluded.length > 0 && (
        <aside
          aria-label="Not included note"
          data-testid="not-included-note"
          className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3.5"
        >
          <p className="text-xs font-semibold text-amber-950">
            Not included (salesperson note — excluded from the video)
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-amber-900">
            {notIncluded.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </aside>
      )}

      {regenError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {regenError}
        </div>
      )}

      <ol className="space-y-4" data-testid="storyboard-scene-list">
        {scenes.map((scene, index) => {
          const words = countWords(scene.narrationText);
          const overLimit = !isNarrationWithinLimit(scene.narrationText);
          const isRegenerating = regeneratingId === scene.id;

          return (
            <li
              key={scene.id}
              data-testid={`scene-card-${index}`}
              className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className="font-mono text-xs font-medium text-slate-400 tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {getSceneTypeLabel(scene.type)}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {scene.title}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <label
                    htmlFor={`duration-${scene.id}`}
                    className="sr-only"
                  >
                    Scene {index + 1} duration in seconds
                  </label>
                  <div className="mr-1 flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                    <input
                      id={`duration-${scene.id}`}
                      type="number"
                      min={4}
                      max={30}
                      value={scene.durationSeconds}
                      onChange={(e) =>
                        onUpdateScene(scene.id, {
                          durationSeconds: Math.max(
                            4,
                            Math.min(30, Number(e.target.value) || 8)
                          ),
                        })
                      }
                      className="w-10 bg-transparent text-right font-mono text-xs text-slate-900 tabular-nums focus:outline-none"
                    />
                    <span className="font-mono text-xs text-slate-500">s</span>
                  </div>

                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMoveScene(index, index - 1)}
                    aria-label={`Move scene ${index + 1} up`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === scenes.length - 1}
                    onClick={() => onMoveScene(index, index + 1)}
                    aria-label={`Move scene ${index + 1} down`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={isRegenerating}
                    onClick={() => handleRegenerate(scene.id)}
                    aria-label={`Regenerate scene ${index + 1}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        isRegenerating ? 'animate-spin' : ''
                      }`}
                      aria-hidden="true"
                    />
                    Regenerate scene
                  </button>
                  <button
                    type="button"
                    disabled={scenes.length <= 1}
                    onClick={() => onDeleteScene(scene.id)}
                    aria-label={`Delete scene ${index + 1}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="lg:col-span-6 space-y-2">
                  <p className="text-xs font-medium text-slate-500">
                    On-screen content
                  </p>
                  <SceneContentPreview scene={scene} />
                </div>

                <div className="lg:col-span-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`narration-${scene.id}`}
                      className="text-xs font-medium text-slate-500"
                    >
                      Narration text
                    </label>
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        overLimit ? 'font-semibold text-red-700' : 'text-slate-500'
                      }`}
                    >
                      {words} / {MAX_NARRATION_WORDS} words
                    </span>
                  </div>
                  <textarea
                    id={`narration-${scene.id}`}
                    rows={4}
                    value={scene.narrationText}
                    onChange={(e) =>
                      onUpdateScene(scene.id, { narrationText: e.target.value })
                    }
                    className={`block w-full rounded-md border bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 focus:outline-none focus:ring-1 ${
                      overLimit
                        ? 'border-red-300 focus:border-red-600 focus:ring-red-600'
                        : 'border-slate-300 focus:border-slate-900 focus:ring-slate-900'
                    }`}
                  />
                  {overLimit && (
                    <p className="text-xs text-red-700">
                      Trim narration to {MAX_NARRATION_WORDS} words or fewer for
                      crisp pacing.
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SceneContentPreview({ scene }: { scene: StoryboardScene }) {
  const c = scene.onScreenContent;

  if (scene.type === 'title_card') {
    return (
      <div className="rounded-md bg-slate-50 p-3.5 text-sm space-y-1">
        <p className="font-semibold text-slate-900">
          {c.headline || 'Prepared for prospect'}
        </p>
        {c.subtitle && <p className="text-xs text-slate-600">{c.subtitle}</p>}
      </div>
    );
  }

  if (scene.type === 'what_we_heard') {
    return (
      <div className="rounded-md bg-slate-50 p-3.5 text-xs space-y-2">
        <p className="font-semibold text-slate-900">
          {c.heading || 'What we heard'}
        </p>
        <ul className="space-y-1.5 text-slate-700">
          {(c.quotes ?? []).map((q, idx) => (
            <li key={idx}>“{q}”</li>
          ))}
        </ul>
      </div>
    );
  }

  if (scene.type === 'conversation') {
    return (
      <div className="rounded-md bg-slate-50 p-3.5 text-xs space-y-2.5">
        {c.articleTitle && (
          <p className="text-slate-500">
            Source article:{' '}
            <span className="font-medium text-slate-800">{c.articleTitle}</span>
          </p>
        )}
        <div className="space-y-1.5">
          {(c.messages ?? []).map((msg, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="font-semibold text-slate-700 shrink-0">
                {msg.speaker === 'customer' ? 'Customer:' : 'AI agent:'}
              </span>
              <span className="text-slate-700">{msg.text}</span>
            </div>
          ))}
        </div>
        {c.handover && (
          <div className="border-t border-slate-200 pt-2">
            <p className="font-semibold text-slate-900">
              Handover to human agent: {c.handover.reason}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
              {c.handover.collectedFields.map((field, idx) => (
                <span key={idx}>
                  {field.label}: <strong className="font-medium text-slate-800">{field.value}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (scene.type === 'capability_callout') {
    return (
      <div className="rounded-md bg-slate-50 p-3.5 text-xs space-y-1.5">
        {c.discoveryQuote && (
          <p className="text-slate-600">Need: “{c.discoveryQuote}”</p>
        )}
        {c.capabilityItem && (
          <p className="font-semibold text-slate-900">
            Capability: {c.capabilityItem}
          </p>
        )}
        {c.explanation && <p className="text-slate-700">{c.explanation}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-slate-50 p-3.5 text-xs space-y-1.5">
      <p className="font-semibold text-slate-900">
        {c.heading || 'Suggested next steps'}
      </p>
      <ul className="list-disc space-y-1 pl-4 text-slate-700">
        {(c.nextSteps ?? []).map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ul>
    </div>
  );
}
