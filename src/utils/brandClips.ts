// Talkdesk logo clips that play before (intro) and after (outro) every
// generated video. Files live in public/brand/. Both are full-frame Talkdesk
// Purple, so they are fitted to 16:9 without cropping; the purple fill makes
// any pillarboxing invisible.

export type BrandClipId = 'intro' | 'outro';

interface BrandClip {
  src: string;
  /** Seconds of the source file to play. */
  start: number;
  end: number;
}

export const BRAND_BACKGROUND = '#5405BD'; // Talkdesk Purple

export const BRAND_CLIPS: Record<BrandClipId, BrandClip> = {
  // Source starts with ~0.5s of white before the animation.
  intro: { src: '/brand/talkdesk-intro.mov', start: 0.5, end: 4.1 },
  outro: { src: '/brand/talkdesk-outro.mov', start: 0, end: 5.95 },
};

export function clipSeconds(id: BrandClipId): number {
  const c = BRAND_CLIPS[id];
  return c.end - c.start;
}

/** Loads a clip. Resolves null if it can't be played in this browser. */
export function loadBrandClip(id: BrandClipId): Promise<HTMLVideoElement | null> {
  const clip = BRAND_CLIPS[id];
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = clip.src;
    const fail = () => resolve(null);
    video.onerror = fail;
    video.onloadeddata = () => {
      video.currentTime = clip.start;
    };
    video.onseeked = () => {
      video.onseeked = null;
      resolve(video);
    };
    window.setTimeout(fail, 8000);
  });
}

/** Draws the clip's current frame, fitted inside the w x h canvas. */
export function drawBrandClipFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number
) {
  ctx.fillStyle = BRAND_BACKGROUND;
  ctx.fillRect(0, 0, w, h);
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  // Trim a 0.5% edge to drop recording-edge artifacts, then fit (contain).
  const sx = vw * 0.005;
  const sy = vh * 0.005;
  const sw = vw - sx * 2;
  const sh = vh - sy * 2;
  const scale = Math.min(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(video, sx, sy, sw, sh, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
