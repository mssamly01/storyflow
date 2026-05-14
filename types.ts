export enum ProductionStage {
  INPUT = 'input',
  ANALYSIS = 'analysis',
  CHARACTER_LOCATION = 'character-location',
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
  storyboard?: string;
  prompts?: string;
  qaReport?: string;
  finalResult?: string;
}

export interface BeatAnalysis {
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

export interface StoryBeat extends BeatAnalysis {
  beatId: number;
  summary?: string;
  characters?: string[];
  location?: string;
  locationId?: string;
  locationState?: string;
  action?: string;
  visualFocus?: string;
}

export interface CoverageCheck {
  allSourceTextCovered: boolean;
  missingText: string;
  duplicatedText: string;
  notes: string;
}

export interface BeatAnalysisResult {
  beats: StoryBeat[];
  coverageCheck?: CoverageCheck;
}

export interface CharacterLocationLibraryResult {
  characters: CharacterProfile[];
  locations: LocationProfile[];
}

export interface CharacterProfile {
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
  eyes?: string;
  signatureFeatures?: string[];
  outfit?: string;
  accessories?: string[];
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
  panelId?: string;
  panelNumber?: number;
  beatId?: number;
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
  panelNumber?: number;
  panelId?: string;
  beatId?: number;
  visualPrompt: string;
  negativePrompt?: string;
  negative_prompt?: string;
  notes?: string;
  timeOfDay?: string;
  sourceUsage?: {
    usedBeatId?: number;
    usedLocationId?: string;
    usedCharacterIds?: string[];
  };
}

export interface QAResult {
  panelNumber?: number;
  panelId?: string;
  beatId?: number;
  status?: "pass" | "warning" | "fail" | "unchecked";
  issues?: string[];
  suggestedPromptPatch?: string;
  visualPrompt?: string;
  qaNotes?: string;
}

export interface FinalResultPanel {
  panelId: string;
  panelNumber: number;
  beatId: number;
  source: {
    originalText: string;
    summary: string;
    timeOfDay: string;
    location: string;
    locationId?: string;
    locationState?: string;
    visibleCharacters: string[];
    props: string[];
    action: string;
    interaction: string;
    posture: string;
    atmosphere: string;
    visualFocus: string;
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
    negativePrompt: string;
  };
  qa: {
    status: "pass" | "warning" | "fail" | "unchecked";
    issues: string[];
    suggestedPromptPatch: string;
  };
  refs: {
    characterIds: string[];
    locationId?: string;
  };
  originalText: string;
  cameraAngle: string;
  framing: string;
  subject: string;
  action: string;
  location_cues: string;
  lighting: string;
  visualPrompt: string;
  negative_prompt: string;
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
