import { useState } from 'react';
import type {
  FollowUpResult,
  FollowUpStatus,
  ProspectBrief,
  SetupInput,
  StoryboardScene,
  TabId,
} from './types/showroom';
import { deleteSceneById, reorderScenes } from './utils/showroomLogic';
import { SetupTab } from './components/SetupTab';
import { StoryboardTab } from './components/StoryboardTab';
import { VideoTab } from './components/VideoTab';
import { FollowUpTab } from './components/FollowUpTab';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'video', label: 'Video' },
  { id: 'followup', label: 'Follow-up' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('setup');

  // Session-only in-memory state (never persisted to database or localStorage)
  const [setupInput, setSetupInput] = useState<SetupInput>({
    prospectName: '',
    industry: '',
    helpContent: '',
    discoveryNotes: '',
    capabilities: '',
    brandColor: '#5405BD', // Talkdesk Purple (Cobalt Primary/9); fixed, not user-editable
    targetLength: 90,
  });

  const [brief, setBrief] = useState<ProspectBrief | null>(null);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [notIncluded, setNotIncluded] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const [transcript, setTranscript] = useState('');
  const [followUpResult, setFollowUpResult] = useState<FollowUpResult | null>(
    null
  );
  const [isAnalyzingFollowUp, setIsAnalyzingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const handleBuildStoryboard = async () => {
    setIsBuilding(true);
    setBuildError(null);
    try {
      const response = await fetch('/api/showroom/build-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupInput),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to build storyboard.');
      }
      setBrief(data.brief ?? null);
      setScenes(data.scenes ?? []);
      setNotIncluded(data.notIncluded ?? []);
    } catch (err) {
      setBuildError(
        err instanceof Error ? err.message : 'Failed to build storyboard.'
      );
    } finally {
      setIsBuilding(false);
    }
  };

  const handleUpdateScene = (
    sceneId: string,
    patch: Partial<StoryboardScene>
  ) => {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.id === sceneId ? { ...scene, ...patch } : scene
      )
    );
  };

  const handleMoveScene = (fromIndex: number, toIndex: number) => {
    setScenes((prev) => reorderScenes(prev, fromIndex, toIndex));
  };

  const handleDeleteScene = (sceneId: string) => {
    setScenes((prev) => deleteSceneById(prev, sceneId));
  };

  const handleRegenerateScene = async (sceneId: string) => {
    const idx = scenes.findIndex((s) => s.id === sceneId);
    if (idx === -1) return;
    const response = await fetch('/api/showroom/regenerate-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: setupInput,
        currentScene: scenes[idx],
        sceneIndex: idx,
        totalScenes: scenes.length,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to regenerate scene.');
    }
    if (data.scene) {
      setScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? data.scene : s))
      );
    }
  };

  const handleFindRequests = async () => {
    setIsAnalyzingFollowUp(true);
    setFollowUpError(null);
    try {
      const response = await fetch('/api/showroom/analyze-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectName: setupInput.prospectName,
          industry: setupInput.industry,
          capabilities: setupInput.capabilities,
          transcript,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze follow-up transcript.');
      }
      setFollowUpResult({
        requests: data.requests ?? [],
        draftEmailSubject: data.draftEmailSubject ?? '',
        draftEmailBody: data.draftEmailBody ?? '',
      });
    } catch (err) {
      setFollowUpError(
        err instanceof Error ? err.message : 'Failed to analyze transcript.'
      );
    } finally {
      setIsAnalyzingFollowUp(false);
    }
  };

  const handleFollowUpStatusChange = (
    requestId: string,
    status: FollowUpStatus
  ) => {
    setFollowUpResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        requests: prev.requests.map((r) =>
          r.id === requestId ? { ...r, status } : r
        ),
      };
    });
  };

  const handleFollowUpEmailChange = (patch: {
    draftEmailSubject?: string;
    draftEmailBody?: string;
  }) => {
    setFollowUpResult((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <div className="min-h-screen bg-cb-bg text-cb-text">
      {/* Permanent top banner required across the whole app */}
      <div
        role="banner"
        className="border-b border-cb-warning-border bg-cb-warning-bg px-4 py-1.5 text-center text-xs font-medium text-cb-warning-text"
      >
        Prototype. Synthetic data only. Do not enter real customer or prospect
        data.
      </div>

      {/* Top Navigation Bar */}
      <header className="border-b border-cb-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-6 sm:py-3.5">
          <span className="font-cobalt text-lg font-bold tracking-tight text-cb-text whitespace-nowrap shrink-0">
            Showroom
          </span>

          <nav
            aria-label="Showroom workspace tabs"
            role="tablist"
            className="flex items-center justify-between gap-1 sm:justify-start sm:gap-2"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-cb-sm px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cb-focus sm:px-3.5 sm:text-sm ${
                    active
                      ? 'bg-cb-primary-subtle font-semibold text-cb-primary-text'
                      : 'text-cb-desc hover:bg-cb-hover hover:text-cb-text'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {activeTab === 'setup' && (
          <SetupTab
            input={setupInput}
            onChange={setSetupInput}
            brief={brief}
            isBuilding={isBuilding}
            buildError={buildError}
            onBuildStoryboard={handleBuildStoryboard}
            onGoToStoryboard={() => setActiveTab('storyboard')}
          />
        )}

        {activeTab === 'storyboard' && (
          <StoryboardTab
            scenes={scenes}
            notIncluded={notIncluded}
            targetLength={setupInput.targetLength}
            onUpdateScene={handleUpdateScene}
            onMoveScene={handleMoveScene}
            onDeleteScene={handleDeleteScene}
            onRegenerateScene={handleRegenerateScene}
            onGoToSetup={() => setActiveTab('setup')}
            onGoToVideo={() => setActiveTab('video')}
          />
        )}

        {activeTab === 'video' && (
          <VideoTab
            scenes={scenes}
            prospectName={setupInput.prospectName}
            brandColor={setupInput.brandColor}
            onGoToSetup={() => setActiveTab('setup')}
          />
        )}

        {activeTab === 'followup' && (
          <FollowUpTab
            transcript={transcript}
            onTranscriptChange={setTranscript}
            result={followUpResult}
            isAnalyzing={isAnalyzingFollowUp}
            analyzeError={followUpError}
            onFindRequests={handleFindRequests}
            onStatusChange={handleFollowUpStatusChange}
            onEmailChange={handleFollowUpEmailChange}
          />
        )}
      </main>
    </div>
  );
}
