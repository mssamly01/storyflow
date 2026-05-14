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
  personalityVisualCues?: string;
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
  keyObjects?: string[];
  lighting?: string;
  atmosphere?: string;
  lightingDefault?: string;
  atmosphereDefault?: string;
  continuityNotes?: string;
  firstAppearanceBeatId?: number | null;
  appearsInBeatIds?: number[];
}

export interface StoryboardPanel {
  panelNumber: number;
  beatId?: number;
  originalText?: string;
  description?: string;
  shotType?: string;
  cameraAngle?: string;
  framing?: string;
  composition?: string;
  lighting?: string;
  visibleCharacters?: string[];
  locationName?: string;
  actionInFrame?: string;
  continuityNotes?: string;
  timeOfDay?: string;
}

export interface EngineerPrompt {
  panelNumber: number;
  beatId?: number;
  visualPrompt: string;
  negativePrompt?: string;
  negative_prompt?: string;
  notes?: string;
  timeOfDay?: string;
}
