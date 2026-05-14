export interface ParsedBlock {
  character: string;
  type: string;
  content: string;
}

export enum ParsingStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

export interface LiteraryChapter {
  id: number;
  chapter: string;
  chapterTitle?: string;
  script: string;
  blocks: ParsedBlock[];
  timestamp: string;
}

export interface LiteraryProject {
  id: number;
  type: 'literary';
  title: string;
  chapters: LiteraryChapter[];
  lastUpdated: string;
}
