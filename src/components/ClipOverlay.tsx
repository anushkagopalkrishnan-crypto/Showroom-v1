import { useEffect, useRef } from 'react';
import {
  BRAND_BACKGROUND,
  BRAND_CLIPS,
  drawBrandClipFrame,
  loadBrandClip,
  type BrandClipId,
} from '../utils/brandClips';

interface ClipOverlayProps {
  clip: BrandClipId;
  /** Called when the clip finishes, fails to load, or can't be played. */
  onDone: () => void;
}

/** Plays a Talkdesk logo clip over the video stage. */
export function ClipOverlay({ clip, onDone }: ClipOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let video: HTMLVideoElement | null = null;
    const end = BRAND_CLIPS[clip].end;

    (async () => {
      video = await loadBrandClip(clip);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!video || !canvas || !ctx) {
        onDoneRef.current();
        return;
      }
      try {
        await video.play();
      } catch {
        onDoneRef.current();
        return;
      }
      const tick = () => {
        if (cancelled || !video) return;
        drawBrandClipFrame(ctx, video, canvas.width, canvas.height);
        if (video.currentTime >= end || video.ended) {
          video.pause();
          onDoneRef.current();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      video?.pause();
    };
  }, [clip]);

  return (
    <div
      data-testid={`${clip}-overlay`}
      className="absolute inset-0 z-30"
      style={{ backgroundColor: BRAND_BACKGROUND }}
    >
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="h-full w-full"
        aria-label="Talkdesk logo animation"
      />
      <div
        aria-label="Draft watermark"
        className="pointer-events-none absolute right-3 top-2.5 text-[10px] font-medium tracking-wide text-white sm:right-4 sm:top-3.5 sm:text-[11px]"
        style={{ opacity: 0.72 }}
      >
        Draft for internal review
      </div>
    </div>
  );
}
