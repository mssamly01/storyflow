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
const STORYFLOW_PROJECT_COMPACT_FIELDS = [
  "id",
  "title",
  "selectedStyleId",
  "screenContinuity",
  "beatMomentDetails",
  "workflow",
  "createdAt",
  "updatedAt"
];

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

function isQuotaError(error: unknown): boolean {
  return Boolean(
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function compactStoryFlowProject(project: StoredProject): StoredProject {
  if ((project as { type?: string }).type === "literary") return project;

  const storyProject = project as StoredStoryFlowProject;
  const rawProduction = storyProject.production;
  const compactProduction = rawProduction && typeof rawProduction === "object" && !Array.isArray(rawProduction)
    ? {
        ...(rawProduction as Record<string, unknown>),
        finalResult: undefined
      }
    : rawProduction;
  const rawStoryFlowProject = storyProject.storyFlowProject;
  if (!rawStoryFlowProject || typeof rawStoryFlowProject !== "object" || Array.isArray(rawStoryFlowProject)) {
    return {
      ...storyProject,
      production: compactProduction
    };
  }

  const compactStoryFlowProject = STORYFLOW_PROJECT_COMPACT_FIELDS.reduce<Record<string, unknown>>((acc, key) => {
    if (key in rawStoryFlowProject) {
      acc[key] = (rawStoryFlowProject as Record<string, unknown>)[key];
    }
    return acc;
  }, {});

  return {
    ...storyProject,
    production: compactProduction,
    storyFlowProject: compactStoryFlowProject
  };
}

function compactStoryFlowTempState() {
  try {
    const raw = localStorage.getItem("storyflow_temp_state");
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;

    const project = parsed.project && typeof parsed.project === "object" && !Array.isArray(parsed.project)
      ? parsed.project as Record<string, unknown>
      : {};

    localStorage.setItem("storyflow_temp_state", JSON.stringify({
      ...parsed,
      production: {
        ...(parsed.production || {}),
        finalResult: undefined
      },
      project: {
        id: project.id,
        title: project.title,
        selectedStyleId: project.selectedStyleId,
        screenContinuity: project.screenContinuity,
        beatMomentDetails: project.beatMomentDetails,
        workflow: project.workflow,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }
    }));
  } catch {
    localStorage.removeItem("storyflow_temp_state");
  }
}

function writeProjectsWithCompaction(projects: StoredProject[]) {
  try {
    writeProjects(projects);
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    compactStoryFlowTempState();
    writeProjects(projects.map(compactStoryFlowProject));
  }
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

  writeProjectsWithCompaction(nextProjects);
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

  writeProjectsWithCompaction(nextProjects);
  return nextProjects.filter((candidate): candidate is LiteraryProject => candidate.type === "literary");
}

export function deleteProjectById(id: number): StoredProject[] {
  const nextProjects = readProjects().filter((project) => project.id !== id);
  writeProjectsWithCompaction(nextProjects);
  return nextProjects;
}
