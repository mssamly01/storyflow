export enum ProductionStage {
  INPUT = 'input',
  ANALYSIS = 'analysis',
  CHARACTER_LOCATION = 'character-location',
  SCREEN_CONTINUITY = 'screen-continuity',
  BEAT_MOMENT = 'beat-moment',
  STORYBOARD = 'storyboard',
  PROMPTS = 'prompts',
  QA = 'qa',
  FINAL = 'final',
  LIBRARY = 'library'
}

export interface ScriptData {
  script: string;
  selectedStyle: string;
  title: string;
  chapter: string;
  chapterTitle?: string;
}

export interface ProductionData {
  analysis?: string;
  characterLocationAnalysis?: string;
  screenContinuity?: string;
  beatMomentDetails?: string;
  storyboard?: string;
  prompts?: string;
  qaReport?: string;
  finalResult?: string;
}

export interface BeatAnalysis {
  meta?: EditableMeta;
  beatId?: number;
  originalText: string;
  actionAnalysis?: string;
  analysis?: string;
  charactersInvolved?: string[];
  locationName?: string;
  interaction?: string;
  posture?: string;
  props?: string[];
  atmosphere?: string;
  timeOfDay?: string;
}

export interface ScreenCharacterState {
  characterName: string;
  characterId?: string;
  outfit: string;
  outfitMainColor?: string;
  outfitAccentColor?: string;
  accessories: string[];
  handheldItems: string[];
  appearanceNotes?: string;
  stateChanges?: string[];
}

export interface StoryScreen {
  meta?: EditableMeta;
  screenId: string;
  screenNumber: number;
  screenName: string;
  location: string;
  locationId?: string;
  timeOfDay: string;
  screenState: string;
  screenCharacters: string[];
  screenProps: string[];
  screenCharacterStates?: ScreenCharacterState[];
  startBeatId: number;
  endBeatId: number;
  summary: string;
  continuityNotes?: string;
}

export interface BeatCharacterMomentDetail {
  characterName: string;
  characterId?: string;
  visibleAccessories?: string[];
  handheldItems?: string[];
  accessoriesChange?: string[];
  momentNotes?: string;
  poseRefinement?: string;
  expression?: string;
}

export interface StoryBeat extends BeatAnalysis {
  beatId: number;
  screenId?: string;
  summary?: string;
  /** @deprecated Use focusCharacters / visibleCharacters / offscreenPresentCharacters. */
  characters?: string[];
  focusCharacters?: string[];
  visibleCharacters?: string[];
  offscreenPresentCharacters?: string[];
  location?: string;
  locationId?: string;
  locationState?: string;
  action?: string;
  visualFocus?: string;
  characterMomentDetails?: BeatCharacterMomentDetail[];
}

export interface ScreenContinuityItem {
  screenId: string;
  screenState: string;
  screenProps: string[];
  screenCharacterStates: ScreenCharacterState[];
  continuityNotes?: string;
}

export interface ScreenContinuityResult {
  screens: ScreenContinuityItem[];
}

export interface BeatMomentDetail {
  beatId: number;
  interaction?: string;
  posture?: string;
  props?: string[];
  locationState?: string;
  characterMomentDetails?: BeatCharacterMomentDetail[];
}

export interface BeatMomentDetailResult {
  beatDetails: BeatMomentDetail[];
}

export interface CoverageCheck {
  allSourceTextCovered: boolean;
  missingText: string;
  duplicatedText: string;
  notes: string;
}

export interface BeatAnalysisResult {
  screens?: StoryScreen[];
  beats: StoryBeat[];
  coverageCheck?: CoverageCheck;
}

export interface CharacterLocationLibraryResult {
  characters: CharacterProfile[];
  locations: LocationProfile[];
}

export interface CharacterProfile {
  meta?: EditableMeta;
  characterId?: string;
  name: string;
  role?: string;
  aliases?: string[];
  gender?: string;
  age?: string;
  height?: string;
  bodyType?: string;
  face?: string;
  hair?: string;
  hairColor?: string;
  eyes?: string;
  eyeColor?: string;
  signatureFeatures?: string[];
  outfit?: string;
  outfitMainColor?: string;
  outfitAccentColor?: string;
  accessories?: string[];
  signatureAccessories?: string[];
  defaultStyle?: string;
  styleNotes?: string;
  props?: string[];
  colorPalette?: string[];
  personalityVisualCues?: string;
  expressionSet?: string[];
  gestureSet?: string[];
  continuityNotes?: string;
  firstAppearanceBeatId?: number | null;
  appearsInBeatIds?: number[];
}

export interface LocationProfile {
  meta?: EditableMeta;
  locationId?: string;
  name: string;
  aliases?: string[];
  description?: string;
  details?: string;
  layout?: string;
  keyObjects?: string[];
  lighting?: string;
  atmosphere?: string;
  colorPalette?: string[];
  baseState?: string;
  lightingDefault?: string;
  atmosphereDefault?: string;
  continuityNotes?: string;
  firstAppearanceBeatId?: number | null;
  appearsInBeatIds?: number[];
}

export interface CharacterBlocking {
  characterId?: string;
  characterName: string;
  framePosition: string;
  bodyPosition: string;
  facingDirection: string;
  expression: string;
  poseRefinement: string;
  interactionWith?: string;
}

export interface StoryboardPanel {
  meta?: EditableMeta;
  beatId?: number;
  /** @deprecated Use beatId only. */
  panelId?: string;
  /** @deprecated Use beatId only. */
  panelNumber?: number;
  shotType?: string;
  cameraAngle?: string;
  cameraDistance?: string;
  lensFeel?: string;
  composition?: string;
  foreground?: string;
  midground?: string;
  background?: string;
  characterBlocking?: CharacterBlocking[];
  lightingDirection?: string;
  depthAndPerspective?: string;
  visualEmphasis?: string;
  cameraNotes?: string;
  /** @deprecated Use StoryBeat.originalText via beatId. */
  originalText?: string;
  /** @deprecated Use StoryBeat action fields via beatId. */
  description?: string;
  framing?: string;
  /** @deprecated Use lightingDirection plus StoryBeat.timeOfDay via beatId. */
  lighting?: string;
  /** @deprecated Use StoryBeat.characters via beatId. */
  visibleCharacters?: string[];
  /** @deprecated Use StoryBeat.location/locationId via beatId. */
  locationName?: string;
  locationId?: string;
  locationState?: string;
  /** @deprecated Use StoryBeat.action via beatId. */
  actionInFrame?: string;
  continuityNotes?: string;
  /** @deprecated Use StoryBeat.timeOfDay via beatId. */
  timeOfDay?: string;
}

export interface EngineerPrompt {
  meta?: EditableMeta;
  beatId: number;
  visualPrompt: string;
  /** @deprecated Use beatId only. */
  panelNumber?: number;
  /** @deprecated Use beatId only. */
  panelId?: string;
}

export interface QAResult {
  meta?: EditableMeta;
  beatId: number;
  status?: "pass" | "warning" | "fail" | "unchecked";
  issues?: string[];
  suggestedPromptPatch?: string;
  visualPrompt?: string;
  qaNotes?: string;
  /** @deprecated Use beatId only. */
  panelNumber?: number;
  /** @deprecated Use beatId only. */
  panelId?: string;
}

export interface FinalResultPanel {
  beatId: number;
  screenId?: string;
  screen?: {
    screenId: string;
    screenName: string;
    location: string;
    locationId?: string;
    timeOfDay: string;
    screenCharacters: string[];
    screenProps: string[];
    screenState: string;
    continuityNotes?: string;
    screenCharacterStates?: ScreenCharacterState[];
  };
  source: {
    originalText: string;
    summary: string;
    timeOfDay: string;
    location: string;
    locationId?: string;
    locationState?: string;
    focusCharacters: string[];
    visibleCharacters: string[];
    offscreenPresentCharacters: string[];
    props: string[];
    action: string;
    interaction: string;
    posture: string;
    atmosphere: string;
    visualFocus: string;
    characterMomentDetails?: BeatCharacterMomentDetail[];
  };
  storyboard: {
    shotType: string;
    cameraAngle: string;
    cameraDistance?: string;
    lensFeel?: string;
    composition: string;
    foreground: string;
    midground: string;
    background: string;
    characterBlocking: CharacterBlocking[];
    lightingDirection: string;
    depthAndPerspective: string;
    visualEmphasis: string;
    cameraNotes: string;
  };
  prompt: {
    visualPrompt: string;
  };
  qa: {
    status: "pass" | "warning" | "fail" | "unchecked";
    issues: string[];
    suggestedPromptPatch: string;
  };
  refs: {
    characterIds: string[];
    locationId?: string;
    screenId?: string;
  };
  /** @deprecated Use beatId only. */
  panelId?: string;
  /** @deprecated Use beatId only. */
  panelNumber?: number;
  originalText: string;
  cameraAngle: string;
  framing: string;
  subject: string;
  action: string;
  location_cues: string;
  lighting: string;
  visualPrompt: string;
  qaNotes?: string;
}

export interface FinalResult {
  panels: FinalResultPanel[];
  metadata: {
    totalPanels: number;
    generatedAt: string;
    source: "code-builder";
  };
}

export type StepStatus =
  | "not_started"
  | "generating"
  | "needs_review"
  | "approved"
  | "stale"
  | "error";

export interface WorkflowStepState {
  status: StepStatus;
  updatedAt?: string;
  approvedAt?: string;
  errorMessage?: string;
}

export interface WorkflowState {
  beatAnalysis: WorkflowStepState;
  characterLocation: WorkflowStepState;
  screenContinuity: WorkflowStepState;
  beatMomentDetails: WorkflowStepState;
  storyboard: WorkflowStepState;
  promptEngineering: WorkflowStepState;
  qa: WorkflowStepState;
  finalResult: WorkflowStepState;
}

export interface EditableMeta {
  status?: StepStatus;
  source?: "ai" | "user" | "code";
  updatedAt?: string;
  approvedAt?: string;
  staleReason?: string;
  locks?: FieldLockState;
}

export interface FieldLockState {
  lockedFields?: string[];
  approvedFields?: string[];
  lockedAt?: string;
  approvedAt?: string;
  lockedBy?: "user" | "system";
}

export interface StoryFlowProject {
  id: string;
  title: string;
  sourceText: string;
  selectedStyleId?: string;
  screens: StoryScreen[];
  beats: StoryBeat[];
  characters: CharacterProfile[];
  locations: LocationProfile[];
  storyboardPanels: StoryboardPanel[];
  engineerPrompts: EngineerPrompt[];
  qaResults: QAResult[];
  screenContinuity?: string;
  beatMomentDetails?: string;
  finalResult: FinalResult | null;
  workflow: WorkflowState;
  createdAt: string;
  updatedAt: string;
}
