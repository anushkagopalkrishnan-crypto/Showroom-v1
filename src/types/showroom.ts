export type TabId = 'setup' | 'storyboard' | 'video' | 'followup';

export type TargetLength = 60 | 90 | 120;

export interface SetupInput {
  prospectName: string;
  industry: string;
  helpContent: string;
  discoveryNotes: string;
  capabilities: string;
  brandColor: string;
  targetLength: TargetLength;
}

export interface ContactReason {
  reason: string;
  articleTitle: string;
}

export interface SkippedItem {
  topic: string;
  quote: string;
}

export interface ProspectBrief {
  summary: string;
  topContactReasons: ContactReason[];
  skippedItems: SkippedItem[];
}

export type SceneType =
  | 'title_card'
  | 'what_we_heard'
  | 'conversation'
  | 'capability_callout'
  | 'closing_card';

export interface ConversationMessage {
  speaker: 'customer' | 'agent';
  text: string;
}

export interface HandoverField {
  label: string;
  value: string;
}

export interface HandoverDetails {
  reason: string;
  collectedFields: HandoverField[];
}

export interface SceneOnScreenContent {
  // title_card
  headline?: string;
  subtitle?: string;
  // what_we_heard
  heading?: string;
  quotes?: string[];
  // conversation
  articleTitle?: string;
  messages?: ConversationMessage[];
  handover?: HandoverDetails | null;
  // capability_callout
  discoveryQuote?: string;
  capabilityItem?: string;
  explanation?: string;
  // closing_card
  nextSteps?: string[];
}

export interface StoryboardScene {
  id: string;
  type: SceneType;
  title: string;
  onScreenContent: SceneOnScreenContent;
  narrationText: string;
  durationSeconds: number;
}

export interface StoryboardResult {
  brief: ProspectBrief;
  scenes: StoryboardScene[];
  notIncluded: string[];
}

export type FollowUpStatus =
  | 'Open'
  | 'In progress'
  | 'Waiting on buyer'
  | 'Done';

export interface FollowUpRequest {
  id: string;
  request: string;
  askedByRole: string;
  exactQuote: string;
  suggestedOwner: string;
  dueDate: string;
  status: FollowUpStatus;
}

export interface FollowUpResult {
  requests: FollowUpRequest[];
  draftEmailSubject: string;
  draftEmailBody: string;
}
