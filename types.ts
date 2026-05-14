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

export interface CharacterProfile {
  name: string;
  role?: string;
  gender?: string;
  age?: string;
  height?: string;
  bodyType?: string;
  face?: string;
  hair?: string;
  eyes?: string;
  signatureFeatures?: string[];
  outfit?: string;
  continuityNotes?: string;
  imagePrompt?: string;
}

export interface LocationProfile {
  name: string;
  description?: string;
  details?: string;
  keyObjects?: string[];
  lightingDefault?: string;
  atmosphereDefault?: string;
  continuityNotes?: string;
  imagePrompt?: string;
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
