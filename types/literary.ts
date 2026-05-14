export interface ParsedBlock {
  character: string;
  type: 'Tương tác' | 'Dẫn chuyện' | string;
  content: string;
}

export interface LiteraryInputData {
  novelName: string;
  chapterNumber: string;
  chapterTitle: string;
  content: string;
}

export interface LiteraryChapter {
  id: number;
  chapter: string;
  chapterTitle: string;
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

export interface ParseResponse {
  blocks: ParsedBlock[];
}

export enum ParsingStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
