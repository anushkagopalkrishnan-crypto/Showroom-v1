import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { StoryboardScene } from '../types/showroom';
import {
  computeTimeline,
  formatTime,
  getChatBubbleProgress,
  getContrastTextColor,
  getPlaybackPosition,
  getSceneTypeLabel,
  getStaggeredRevealCount,
  mixHexColor,
  normalizeHexColor,
} from '../utils/showroomLogic';
import { exportStoryboardWebm } from '../utils/videoExporter';
import { ClipOverlay } from './ClipOverlay';

interface VideoTabProps {
  scenes: StoryboardScene[];
  prospectName: string;
  brandColor: string;
  onGoToSetup: () => void;
}

interface CachedTtsEntry {
  url: string;
  buffer: ArrayBuffer;
  duration: number;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function VideoTab({
  scenes,
  prospectName,
  brandColor,
  onGoToSetup,
}: VideoTabProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  // Talkdesk logo intro that plays before the scenes when starting from 0:00
  const [introPlaying, setIntroPlaying] = useState(false);
  // Talkdesk ending clip that plays after the last scene
  const [outroPlaying, setOutroPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'fallback'
  >('idle');
  const [cachedCount, setCachedCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  const ttsCacheRef = useRef<Map<string, CachedTtsEntry>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenSceneKeyRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const brand = useMemo(() => normalizeHexColor(brandColor), [brandColor]);
  const contrastInk = useMemo(() => getContrastTextColor(brand), [brand]);
  const deepBrand = useMemo(() => mixHexColor(brand, '#0F172A', 0.38), [brand]);
  const softBrand = useMemo(() => mixHexColor(brand, '#FFFFFF', 0.92), [brand]);

  // Adjust scene durations slightly if cached TTS audio exceeds initial duration so narration never clips
  const effectiveScenes = useMemo(() => {
    return scenes.map((scene) => {
      const key = `${scene.id}::${scene.narrationText}`;
      const cached = ttsCacheRef.current.get(key);
      if (cached && cached.duration > scene.durationSeconds) {
        return {
          ...scene,
          durationSeconds: Math.ceil(cached.duration) + 1,
        };
      }
      return scene;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, cachedCount]);

  const timeline = useMemo(
    () => computeTimeline(effectiveScenes),
    [effectiveScenes]
  );

  const position = useMemo(
    () => getPlaybackPosition(timeline, elapsed),
    [timeline, elapsed]
  );

  const currentScene = effectiveScenes[position.sceneIndex] ?? effectiveScenes[0];

  const stopAllAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    lastSpokenSceneKeyRef.current = null;
  }, []);

  // Pre-generate Gemini TTS audio in background when scenes are ready
  useEffect(() => {
    if (scenes.length === 0) return;
    let cancelled = false;

    const loadAllTts = async () => {
      setTtsStatus('loading');
      let anyFallback = false;
      let loaded = 0;

      for (const scene of scenes) {
        if (cancelled) return;
        const key = `${scene.id}::${scene.narrationText}`;
        if (ttsCacheRef.current.has(key)) {
          loaded++;
          setCachedCount(loaded);
          continue;
        }
        try {
          const res = await fetch('/api/showroom/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: scene.narrationText }),
          });
          const data = (await res.json()) as {
            fallback?: boolean;
            mimeType?: string;
            audioBase64?: string;
          };

          if (cancelled) return;

          if (!data.fallback && data.audioBase64) {
            const buffer = base64ToArrayBuffer(data.audioBase64);
            const blob = new Blob([buffer], {
              type: data.mimeType || 'audio/wav',
            });
            const url = URL.createObjectURL(blob);

            const duration = await new Promise<number>((resolve) => {
              const probe = new Audio(url);
              probe.onloadedmetadata = () =>
                resolve(Number.isFinite(probe.duration) ? probe.duration : scene.durationSeconds);
              probe.onerror = () => resolve(scene.durationSeconds);
            });

            ttsCacheRef.current.set(key, { url, buffer, duration });
            loaded++;
            setCachedCount((c) => c + 1);
          } else {
            anyFallback = true;
          }
        } catch {
          anyFallback = true;
        }
      }

      if (!cancelled) {
        setTtsStatus(anyFallback && loaded === 0 ? 'fallback' : 'ready');
      }
    };

    loadAllTts();

    return () => {
      cancelled = true;
    };
  }, [scenes]);

  // Cleanup audio on unmount or tab switch
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  // Trigger voiceover when active scene changes while playing
  useEffect(() => {
    if (!isPlaying || !currentScene) return;
    const key = `${currentScene.id}::${currentScene.narrationText}`;
    if (lastSpokenSceneKeyRef.current === key) return;
    lastSpokenSceneKeyRef.current = key;

    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (isMuted) return;

    const cached = ttsCacheRef.current.get(key);
    if (cached) {
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = cached.url;
      audio.currentTime = Math.min(
        position.sceneElapsed,
        Math.max(0, cached.duration - 0.3)
      );
      audio.play().catch(() => {
        // Fallback to browser speech synthesis if autoplay blocked
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(currentScene.narrationText);
          window.speechSynthesis.speak(utterance);
        }
      });
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(currentScene.narrationText);
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    }
  }, [isPlaying, currentScene, isMuted, position.sceneElapsed]);

  // Smooth playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastFrameTimeRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const delta = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      setElapsed((prev) => {
        const next = prev + delta;
        if (next >= timeline.totalDuration) {
          setIsPlaying(false);
          stopAllAudio();
          setOutroPlaying(true);
          return timeline.totalDuration;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastFrameTimeRef.current = null;
    };
  }, [isPlaying, timeline.totalDuration, stopAllAudio]);

  if (scenes.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">
          No video scenes ready yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Build a storyboard from the Setup tab first, then return here to play
          the narrated 16:9 demo video.
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

  const handleIntroDone = () => {
    setIntroPlaying(false);
    lastSpokenSceneKeyRef.current = null;
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    if (introPlaying) {
      setIntroPlaying(false);
      return;
    }
    if (outroPlaying) {
      setOutroPlaying(false);
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      stopAllAudio();
      return;
    }
    if (elapsed >= timeline.totalDuration - 0.1) {
      setElapsed(0);
      setIntroPlaying(true);
      return;
    }
    if (elapsed < 0.05) {
      setIntroPlaying(true);
      return;
    }
    lastSpokenSceneKeyRef.current = null;
    setIsPlaying(true);
  };

  const handleRestart = () => {
    stopAllAudio();
    setElapsed(0);
    lastSpokenSceneKeyRef.current = null;
    setIsPlaying(false);
    setOutroPlaying(false);
    setIntroPlaying(true);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      stopAllAudio();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))
    );
    const targetSeconds = ratio * timeline.totalDuration;
    stopAllAudio();
    setElapsed(targetSeconds);
  };

  const handleDownloadVideo = async () => {
    setExportError(null);
    setIsExporting(true);
    setExportProgress(0);
    try {
      const audioMap = new Map<string, ArrayBuffer>();
      ttsCacheRef.current.forEach((val, key) => {
        audioMap.set(key, val.buffer);
      });
      const blob = await exportStoryboardWebm({
        scenes: effectiveScenes,
        brandColor: brand,
        prospectName,
        audioBySceneKey: audioMap,
        onProgress: setExportProgress,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = (prospectName || 'prospect')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      a.href = url;
      a.download = `showroom-${slug || 'demo'}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Unable to export video file.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Video preview
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
            <span>
              Scene {position.sceneIndex + 1} of {effectiveScenes.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>{getSceneTypeLabel(currentScene.type)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {ttsStatus === 'loading'
                ? `Preparing Gemini voiceover (${cachedCount}/${scenes.length})`
                : ttsStatus === 'fallback'
                  ? 'Browser speech synthesis fallback'
                  : 'Gemini voiceover ready'}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isExporting}
          onClick={handleDownloadVideo}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Exporting video {exportProgress}%
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download video
            </>
          )}
        </button>
      </div>

      {exportError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800"
        >
          {exportError}
        </div>
      )}

      {/* 16:9 Video Stage + Synchronized Captions */}
      <div
        data-testid="video-stage"
        data-playing={isPlaying ? 'true' : 'false'}
        data-scene-index={position.sceneIndex}
        data-scene-type={currentScene.type}
        className="overflow-hidden rounded-lg border border-slate-300 bg-slate-950 shadow-sm"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
          <StageSceneRenderer
            scene={currentScene}
            sceneProgress={position.sceneProgress}
            brand={brand}
            deepBrand={deepBrand}
            softBrand={softBrand}
            contrastInk={contrastInk}
          />

          {introPlaying && <ClipOverlay clip="intro" onDone={handleIntroDone} />}
          {outroPlaying && (
            <ClipOverlay clip="outro" onDone={() => setOutroPlaying(false)} />
          )}

          {/* Watermark on every scene */}
          <div
            aria-label="Draft watermark"
            className="pointer-events-none absolute right-3 top-2.5 z-20 text-[10px] font-medium tracking-wide sm:right-4 sm:top-3.5 sm:text-[11px]"
            style={{
              color:
                currentScene.type === 'title_card' ||
                currentScene.type === 'closing_card'
                  ? contrastInk
                  : '#334155',
              opacity: 0.72,
            }}
          >
            Draft for internal review
          </div>
        </div>

        {/* Synchronized Captions */}
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-center sm:px-6 sm:py-3.5">
          <p
            data-testid="video-captions"
            className="mx-auto max-w-3xl text-xs leading-snug text-white sm:text-base"
          >
            {introPlaying || outroPlaying ? ' ' : currentScene.narrationText}
          </p>
        </div>
      </div>

      {/* Player Controls */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Video playback progress"
          aria-valuemin={0}
          aria-valuemax={timeline.totalDuration}
          aria-valuenow={Math.round(elapsed)}
          onClick={handleSeek}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              setElapsed((p) => Math.min(timeline.totalDuration, p + 5));
            } else if (e.key === 'ArrowLeft') {
              setElapsed((p) => Math.max(0, p - 5));
            }
          }}
          className="relative h-2.5 w-full cursor-pointer overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full transition-[width] duration-75"
            style={{
              width: `${Math.min(100, position.totalProgress * 100)}%`,
              backgroundColor: brand,
            }}
          />
          {timeline.segments.slice(1).map((seg) => (
            <span
              key={seg.sceneId}
              aria-hidden="true"
              className="absolute top-0 bottom-0 w-px bg-white/80"
              style={{
                left: `${(seg.start / Math.max(1, timeline.totalDuration)) * 100}%`,
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {isPlaying || introPlaying || outroPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Play
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restart
            </button>
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute voiceover' : 'Mute voiceover'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="font-mono text-xs text-slate-600 tabular-nums">
            {formatTime(elapsed)} / {formatTime(timeline.totalDuration)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageSceneRenderer({
  scene,
  sceneProgress,
  brand,
  deepBrand,
  softBrand,
  contrastInk,
}: {
  scene: StoryboardScene;
  sceneProgress: number;
  brand: string;
  deepBrand: string;
  softBrand: string;
  contrastInk: '#FFFFFF' | '#0F172A';
}) {
  const c = scene.onScreenContent;

  if (scene.type === 'title_card') {
    const opacity = Math.min(1, 0.25 + sceneProgress * 2.5);
    return (
      <div
        className="flex h-full w-full flex-col justify-center px-6 py-6 sm:px-16"
        style={{
          background: `linear-gradient(135deg, ${brand} 0%, ${deepBrand} 100%)`,
          color: contrastInk,
        }}
      >
        <div
          className="max-w-3xl space-y-2 transition-opacity duration-300 sm:space-y-4"
          style={{ opacity }}
        >
          <p className="text-[11px] font-medium tracking-wide opacity-80 sm:text-xs">
            Tailored walkthrough
          </p>
          <h2 className="text-xl font-bold leading-tight tracking-tight text-balance sm:text-5xl">
            {c.headline || 'Prepared for prospect'}
          </h2>
          {c.subtitle && (
            <p className="max-w-2xl text-xs leading-relaxed opacity-90 sm:text-xl">
              {c.subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (scene.type === 'closing_card') {
    const opacity = Math.min(1, 0.25 + sceneProgress * 2.5);
    return (
      <div
        className="flex h-full w-full flex-col justify-center px-6 py-6 sm:px-16"
        style={{
          background: `linear-gradient(135deg, ${brand} 0%, ${deepBrand} 100%)`,
          color: contrastInk,
        }}
      >
        <div className="max-w-3xl space-y-3 sm:space-y-5" style={{ opacity }}>
          <h2 className="text-lg font-bold tracking-tight sm:text-4xl">
            {c.heading || 'Suggested next steps'}
          </h2>
          <ul className="space-y-2 sm:space-y-3">
            {(c.nextSteps ?? []).map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs sm:gap-3 sm:text-lg opacity-95"
              >
                <span className="mt-0.5 font-mono text-[10px] opacity-75 tabular-nums sm:mt-1 sm:text-xs">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (scene.type === 'what_we_heard') {
    const quotes = c.quotes ?? [];
    const revealed = getStaggeredRevealCount(sceneProgress, quotes.length);

    return (
      <div
        className="flex h-full w-full flex-col justify-center px-8 pt-6 pb-20 sm:px-14"
        style={{
          background: `linear-gradient(180deg, ${softBrand} 0%, #F8FAFC 100%)`,
        }}
      >
        <div
          className="mb-3 h-1 w-14 rounded-full"
          style={{ backgroundColor: brand }}
        />
        <h2 className="text-xl font-bold text-slate-900 sm:text-3xl">
          {c.heading || 'What we heard'}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3">
          {quotes.map((quote, idx) => {
            const visible = idx < revealed;
            return (
              <div
                key={idx}
                className="rounded-lg border border-slate-200 bg-white px-5 py-3 transition-all duration-300"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0px)' : 'translateY(10px)',
                }}
              >
                <p className="text-sm leading-relaxed text-slate-800 sm:text-base">
                  “{quote}”
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (scene.type === 'conversation') {
    const messages = c.messages ?? [];
    const chatState = getChatBubbleProgress(
      sceneProgress,
      messages.length,
      Boolean(c.handover)
    );

    return (
      <div className="flex h-full w-full flex-col bg-slate-50 pb-16">
        <div
          className="flex items-center justify-between border-b border-slate-200 px-8 py-3.5"
          style={{ backgroundColor: softBrand }}
        >
          <p className="text-xs font-semibold text-slate-900 sm:text-sm">
            Help article: {c.articleTitle || 'Knowledge base'}
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-hidden px-8 py-5 sm:px-12">
          {messages.slice(0, chatState.visibleCount).map((msg, idx) => {
            const isCustomer = msg.speaker === 'customer';
            const isTyping = idx === chatState.activeTypingIndex;
            const visibleText = isTyping
              ? msg.text.slice(
                  0,
                  Math.max(1, Math.ceil(msg.text.length * chatState.activeCharRatio))
                )
              : msg.text;

            return (
              <div
                key={idx}
                className={`flex ${
                  isCustomer ? 'justify-start' : 'justify-end'
                }`}
              >
                <div
                  className={`max-w-[78%] rounded-xl px-4 py-2.5 text-xs leading-relaxed sm:text-sm ${
                    isCustomer
                      ? 'border border-slate-200 bg-white text-slate-900'
                      : ''
                  }`}
                  style={
                    isCustomer
                      ? undefined
                      : { backgroundColor: brand, color: contrastInk }
                  }
                >
                  <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                    {isCustomer ? 'Customer' : 'AI agent'}
                  </p>
                  <p>
                    {visibleText}
                    {isTyping && (
                      <span
                        aria-hidden="true"
                        className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle"
                      />
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {chatState.showHandover && c.handover && (
            <div
              className="mt-2 rounded-lg border bg-white px-4 py-3 transition-opacity duration-300"
              style={{ borderColor: brand }}
            >
              <p className="text-xs font-semibold text-slate-900">
                Handed over to human agent — {c.handover.reason}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                {c.handover.collectedFields.map((field, fIdx) => (
                  <span key={fIdx}>
                    {field.label}:{' '}
                    <strong className="font-medium text-slate-900">
                      {field.value}
                    </strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // capability_callout
  const opacity = Math.min(1, 0.25 + sceneProgress * 2.5);
  return (
    <div className="flex h-full w-full flex-col justify-center bg-slate-50 px-8 pb-16 sm:px-14">
      <div className="space-y-4" style={{ opacity }}>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Matched capability
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500">
              Discovery need
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-900 sm:text-base">
              “{c.discoveryQuote}”
            </p>
          </div>
          <div
            className="rounded-lg p-5"
            style={{ backgroundColor: brand, color: contrastInk }}
          >
            <p className="text-xs font-semibold opacity-80">Our capability</p>
            <p className="mt-2 text-sm font-semibold leading-snug sm:text-base">
              {c.capabilityItem}
            </p>
            {c.explanation && (
              <p className="mt-2 text-xs leading-relaxed opacity-90 sm:text-sm">
                {c.explanation}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
