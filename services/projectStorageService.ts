import type { LiteraryProject } from "../types/literary";

export interface StoredStoryFlowProject {
  id: number;
  type?: "storyflow";
  inputData?: {
    title?: string;
    chapter?: string;
    [key: string]: unknown;
  };
  timestamp?: string;
  [key: string]: unknown;
}

export type StoredProject = StoredStoryFlowProject | LiteraryProject;

const STORAGE_KEY = "storyflow_saved_projects";

function readProjects(): StoredProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProjects(projects: StoredProject[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function loadProjects(): StoredProject[] {
  return readProjects().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
}

export function loadStoryFlowProjects(): StoredStoryFlowProject[] {
  return loadProjects().filter((project): project is StoredStoryFlowProject => project.type === "storyflow" || !project.type);
}

export function loadLiteraryProjects(): LiteraryProject[] {
  return loadProjects().filter((project): project is LiteraryProject => project.type === "literary");
}

export function saveStoryFlowProject(project: StoredStoryFlowProject): StoredStoryFlowProject[] {
  const projects = readProjects();
  const existingIndex = projects.findIndex((candidate) => {
    if (candidate.type === "literary") return false;
    const storyProject = candidate as StoredStoryFlowProject;
    return (
      storyProject.inputData?.title === project.inputData?.title &&
      storyProject.inputData?.chapter === project.inputData?.chapter
    );
  });

  const nextProjects = existingIndex >= 0
    ? projects.map((candidate, index) => index === existingIndex ? project : candidate)
    : [project, ...projects];

  writeProjects(nextProjects);
  return nextProjects.filter((candidate): candidate is StoredStoryFlowProject => candidate.type === "storyflow" || !candidate.type);
}

export function saveLiteraryProject(project: LiteraryProject): LiteraryProject[] {
  const projects = readProjects();
  const existingIndex = projects.findIndex((candidate) => candidate.type === "literary" && candidate.title === project.title);
  const existingProject = existingIndex >= 0 ? projects[existingIndex] as LiteraryProject : null;
  const incomingChapter = project.chapters[0];

  const mergedProject: LiteraryProject = existingProject
    ? {
        ...existingProject,
        chapters: incomingChapter
          ? [
              ...existingProject.chapters.filter((chapter) => chapter.chapter !== incomingChapter.chapter),
              incomingChapter
            ].sort((a, b) => {
              const aNum = parseInt(String(a.chapter).replace(/\D/g, ""), 10) || 0;
              const bNum = parseInt(String(b.chapter).replace(/\D/g, ""), 10) || 0;
              return aNum - bNum;
            })
          : existingProject.chapters,
        lastUpdated: project.lastUpdated
      }
    : project;

  const nextProjects = existingIndex >= 0
    ? projects.map((candidate, index) => index === existingIndex ? mergedProject : candidate)
    : [mergedProject, ...projects];

  writeProjects(nextProjects);
  return nextProjects.filter((candidate): candidate is LiteraryProject => candidate.type === "literary");
}

export function deleteProjectById(id: number): StoredProject[] {
  const nextProjects = readProjects().filter((project) => project.id !== id);
  writeProjects(nextProjects);
  return nextProjects;
}
