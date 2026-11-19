import type { SetupInput, StoryboardScene } from '../types/showroom';

export const MAX_NARRATION_WORDS = 40;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function isNarrationWithinLimit(
  text: string,
  maxWords: number = MAX_NARRATION_WORDS
): boolean {
  return countWords(text) <= maxWords;
}

export function validateSetupInput(input: SetupInput): {
  valid: boolean;
  errors: Partial<Record<keyof SetupInput, string>>;
} {
  const errors: Partial<Record<keyof SetupInput, string>> = {};

  if (!input.prospectName.trim()) {
    errors.prospectName = 'Enter a synthetic prospect name.';
  }
  if (!input.industry.trim()) {
    errors.industry = 'Enter the prospect industry.';
  }
  if (input.helpContent.trim().length < 20) {
    errors.helpContent =
      'Paste or upload synthetic help content (at least 20 characters).';
  }
  if (input.discoveryNotes.trim().length < 20) {
    errors.discoveryNotes =
      'Paste or upload synthetic discovery notes (at least 20 characters).';
  }
  if (input.capabilities.trim().length < 10) {
    errors.capabilities =
      'List at least one product capability our video may reference.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function reorderScenes(
  scenes: StoryboardScene[],
  fromIndex: number,
  toIndex: number
): StoryboardScene[] {
  if (
    fromIndex < 0 ||
    fromIndex >= scenes.length ||
    toIndex < 0 ||
    toIndex >= scenes.length ||
    fromIndex === toIndex
  ) {
    return scenes;
  }
  const next = [...scenes];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function deleteSceneById(
  scenes: StoryboardScene[],
  sceneId: string
): StoryboardScene[] {
  return scenes.filter((scene) => scene.id !== sceneId);
}

export interface TimelineSegment {
  sceneId: string;
  index: number;
  start: number;
  end: number;
  duration: number;
}

export interface Timeline {
  totalDuration: number;
  segments: TimelineSegment[];
}

export function computeTimeline(scenes: StoryboardScene[]): Timeline {
  let cursor = 0;
  const segments: TimelineSegment[] = scenes.map((scene, index) => {
    const duration = Math.max(3, Number(scene.durationSeconds) || 8);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;
    return {
      sceneId: scene.id,
      index,
      start,
      end,
      duration,
    };
  });

  return {
    totalDuration: cursor,
    segments,
  };
}

export interface PlaybackPosition {
  sceneIndex: number;
  sceneElapsed: number;
  sceneProgress: number;
  totalProgress: number;
  isFinished: boolean;
}

export function getPlaybackPosition(
  timeline: Timeline,
  elapsedSeconds: number
): PlaybackPosition {
  if (timeline.segments.length === 0 || timeline.totalDuration <= 0) {
    return {
      sceneIndex: 0,
      sceneElapsed: 0,
      sceneProgress: 0,
      totalProgress: 0,
      isFinished: true,
    };
  }

  const clamped = Math.max(0, Math.min(elapsedSeconds, timeline.totalDuration));
  const isFinished = elapsedSeconds >= timeline.totalDuration;

  if (isFinished) {
    const lastIndex = timeline.segments.length - 1;
    const lastSeg = timeline.segments[lastIndex];
    return {
      sceneIndex: lastIndex,
      sceneElapsed: lastSeg.duration,
      sceneProgress: 1,
      totalProgress: 1,
      isFinished: true,
    };
  }

  for (const seg of timeline.segments) {
    if (clamped < seg.end) {
      const sceneElapsed = clamped - seg.start;
      return {
        sceneIndex: seg.index,
        sceneElapsed,
        sceneProgress: Math.max(0, Math.min(1, sceneElapsed / seg.duration)),
        totalProgress: Math.max(0, Math.min(1, clamped / timeline.totalDuration)),
        isFinished: false,
      };
    }
  }

  const lastIndex = timeline.segments.length - 1;
  const lastSeg = timeline.segments[lastIndex];
  return {
    sceneIndex: lastIndex,
    sceneElapsed: lastSeg.duration,
    sceneProgress: 1,
    totalProgress: 1,
    isFinished: true,
  };
}

export function getStaggeredRevealCount(
  sceneProgress: number,
  itemCount: number
): number {
  if (itemCount <= 0) return 0;
  if (sceneProgress <= 0.05) return 1;
  const windowEnd = 0.78;
  const step = windowEnd / itemCount;
  let count = 0;
  for (let i = 0; i < itemCount; i++) {
    if (sceneProgress >= i * step + 0.04) {
      count++;
    }
  }
  return Math.max(1, Math.min(itemCount, count));
}

export interface ChatRevealState {
  visibleCount: number;
  activeTypingIndex: number;
  activeCharRatio: number;
  showHandover: boolean;
}

export function getChatBubbleProgress(
  sceneProgress: number,
  messagesCount: number,
  hasHandover: boolean
): ChatRevealState {
  if (messagesCount <= 0) {
    return {
      visibleCount: 0,
      activeTypingIndex: -1,
      activeCharRatio: 0,
      showHandover: hasHandover && sceneProgress >= 0.4,
    };
  }

  const chatWindowEnd = hasHandover ? 0.72 : 0.9;
  const perMessage = chatWindowEnd / messagesCount;

  let visibleCount = 0;
  let activeTypingIndex = -1;
  let activeCharRatio = 1;

  for (let i = 0; i < messagesCount; i++) {
    const start = i * perMessage;
    const typeDuration = perMessage * 0.68;
    if (sceneProgress >= start) {
      visibleCount = i + 1;
      if (sceneProgress < start + typeDuration) {
        activeTypingIndex = i;
        activeCharRatio = Math.max(
          0.12,
          Math.min(1, (sceneProgress - start) / typeDuration)
        );
      }
    }
  }

  if (visibleCount === 0) {
    visibleCount = 1;
    activeTypingIndex = 0;
    activeCharRatio = 0.15;
  }

  const showHandover = hasHandover && sceneProgress >= 0.74;

  return {
    visibleCount,
    activeTypingIndex,
    activeCharRatio,
    showHandover,
  };
}

export function normalizeHexColor(hex: string): string {
  const cleaned = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return (
      '#' +
      cleaned
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return '#' + cleaned.toUpperCase();
  }
  return '#1D4ED8';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function getContrastTextColor(hexColor: string): '#FFFFFF' | '#0F172A' {
  const { r, g, b } = hexToRgb(hexColor);
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.36 ? '#0F172A' : '#FFFFFF';
}

export function mixHexColor(
  baseHex: string,
  targetHex: string,
  ratio: number
): string {
  const t = Math.max(0, Math.min(1, ratio));
  const a = hexToRgb(baseHex);
  const b = hexToRgb(targetHex);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return (
    '#' +
    [r, g, bl]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getSceneTypeLabel(type: StoryboardScene['type']): string {
  switch (type) {
    case 'title_card':
      return 'Title card';
    case 'what_we_heard':
      return 'What we heard';
    case 'conversation':
      return 'Conversation';
    case 'capability_callout':
      return 'Capability callout';
    case 'closing_card':
      return 'Closing card';
  }
}
