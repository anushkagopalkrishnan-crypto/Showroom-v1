import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTimeline,
  countWords,
  deleteSceneById,
  formatTime,
  getChatBubbleProgress,
  getContrastTextColor,
  getPlaybackPosition,
  getStaggeredRevealCount,
  isNarrationWithinLimit,
  reorderScenes,
  validateSetupInput,
} from './showroomLogic';
import type { SetupInput, StoryboardScene } from '../types/showroom';

const sampleScenes: StoryboardScene[] = [
  {
    id: 's1',
    type: 'title_card',
    title: 'Intro',
    onScreenContent: { headline: 'Prepared for Northwind', subtitle: 'Overview' },
    narrationText: 'Welcome to this tailored walkthrough for Northwind.',
    durationSeconds: 10,
  },
  {
    id: 's2',
    type: 'what_we_heard',
    title: 'Needs',
    onScreenContent: { heading: 'What we heard', quotes: ['Quote A', 'Quote B', 'Quote C'] },
    narrationText: 'You told us queue wait times are rising during tax season.',
    durationSeconds: 15,
  },
  {
    id: 's3',
    type: 'closing_card',
    title: 'Next steps',
    onScreenContent: { heading: 'Next steps', nextSteps: ['Technical session'] },
    narrationText: 'Let us schedule a technical architecture review next week.',
    durationSeconds: 10,
  },
];

test('countWords and narration limit enforce 40-word cap', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   one two   three '), 3);
  const fortyWords = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
  const fortyOneWords = `${fortyWords} extra`;
  assert.equal(isNarrationWithinLimit(fortyWords), true);
  assert.equal(isNarrationWithinLimit(fortyOneWords), false);
});

test('validateSetupInput rejects empty required fields without bypassing', () => {
  const empty: SetupInput = {
    prospectName: '',
    industry: '',
    helpContent: 'short',
    discoveryNotes: '',
    capabilities: '',
    brandColor: '#1D4ED8',
    targetLength: 90,
  };
  const res = validateSetupInput(empty);
  assert.equal(res.valid, false);
  assert.ok(res.errors.prospectName);
  assert.ok(res.errors.industry);
  assert.ok(res.errors.helpContent);
  assert.ok(res.errors.discoveryNotes);
  assert.ok(res.errors.capabilities);
});

test('reorderScenes and deleteSceneById update scene list immutably', () => {
  const reordered = reorderScenes(sampleScenes, 0, 2);
  assert.deepEqual(
    reordered.map((s) => s.id),
    ['s2', 's3', 's1']
  );
  // original untouched
  assert.deepEqual(
    sampleScenes.map((s) => s.id),
    ['s1', 's2', 's3']
  );

  const deleted = deleteSceneById(sampleScenes, 's2');
  assert.deepEqual(
    deleted.map((s) => s.id),
    ['s1', 's3']
  );
});

test('computeTimeline and getPlaybackPosition map elapsed time across scenes without gaps', () => {
  const timeline = computeTimeline(sampleScenes);
  assert.equal(timeline.totalDuration, 35);
  assert.equal(timeline.segments[0].start, 0);
  assert.equal(timeline.segments[0].end, 10);
  assert.equal(timeline.segments[1].start, 10);
  assert.equal(timeline.segments[1].end, 25);

  const posStart = getPlaybackPosition(timeline, 0);
  assert.equal(posStart.sceneIndex, 0);
  assert.equal(posStart.sceneProgress, 0);
  assert.equal(posStart.isFinished, false);

  const posMid = getPlaybackPosition(timeline, 17.5);
  assert.equal(posMid.sceneIndex, 1);
  assert.equal(posMid.sceneElapsed, 7.5);
  assert.equal(posMid.sceneProgress, 0.5);

  const posEnd = getPlaybackPosition(timeline, 40);
  assert.equal(posEnd.sceneIndex, 2);
  assert.equal(posEnd.isFinished, true);
  assert.equal(posEnd.totalProgress, 1);
});

test('staggered quote and chat bubble progression reveal incrementally', () => {
  assert.equal(getStaggeredRevealCount(0.02, 3), 1);
  assert.equal(getStaggeredRevealCount(0.45, 3), 2);
  assert.equal(getStaggeredRevealCount(0.85, 3), 3);

  const earlyChat = getChatBubbleProgress(0.05, 3, true);
  assert.equal(earlyChat.visibleCount, 1);
  assert.equal(earlyChat.showHandover, false);

  const lateChat = getChatBubbleProgress(0.85, 3, true);
  assert.equal(lateChat.visibleCount, 3);
  assert.equal(lateChat.showHandover, true);
});

test('getContrastTextColor chooses readable ink against light and dark brand colors', () => {
  assert.equal(getContrastTextColor('#0F172A'), '#FFFFFF');
  assert.equal(getContrastTextColor('#1D4ED8'), '#FFFFFF');
  assert.equal(getContrastTextColor('#FACC15'), '#0F172A');
  assert.equal(getContrastTextColor('#E2E8F0'), '#0F172A');
});

test('formatTime formats mm:ss cleanly', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(120), '2:00');
});
