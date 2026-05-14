
export enum ProductionStage {
  INPUT = 'INPUT',
  ANALYSIS = 'ANALYSIS',
  CHARACTER_LOCATION = 'CHARACTER_LOCATION',
  STORYBOARD = 'STORYBOARD',
  PROMPTS = 'PROMPTS',
  QA = 'QA',
  FINAL = 'FINAL',
  LIBRARY = 'LIBRARY',
  LIT_PARSER = 'LIT_PARSER'
}

export interface ScriptData {
  script: string;
  selectedStyle: string;
  title: string;
  chapter: string;
  chapterTitle: string;
}

export interface ProductionData {
  analysis?: string;
  characterLocationAnalysis?: string;
  storyboard?: string;
  prompts?: string;
  qaReport?: string;
  finalResult?: string;
}
