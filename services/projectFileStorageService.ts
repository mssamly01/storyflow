const API_BASE = "/api";

export interface SavedChapterSummary {
  chapterId: string;
  chapter: string;
  chapterTitle: string;
  fileName: string;
  relativePath: string;
  updatedAt: string;
  createdAt?: string;
  hasFinalResult: boolean;
  hasStoryboard?: boolean;
  hasPrompts?: boolean;
}

export interface SavedNovelSummary {
  novelId: string;
  folderName: string;
  title: string;
  updatedAt: string;
  chapters: SavedChapterSummary[];
}

export interface StoryFlowProjectLibrary {
  novels: SavedNovelSummary[];
}

async function assertOk(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || fallbackMessage);
  }
}

export async function loadStoryFlowProjects(): Promise<StoryFlowProjectLibrary> {
  const response = await fetch(`${API_BASE}/storyflow-projects`);
  await assertOk(response, "Cannot load project library.");
  return response.json();
}

export async function saveStoryFlowProject(project: any): Promise<any> {
  const response = await fetch(`${API_BASE}/storyflow-projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  });

  await assertOk(response, "Cannot save project.");
  return response.json();
}

export async function openStoryFlowProject(novelFolder: string, chapterFile: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/storyflow-projects/${encodeURIComponent(
      novelFolder
    )}/${encodeURIComponent(chapterFile)}`
  );

  await assertOk(response, "Cannot open project.");
  return response.json();
}

export async function deleteStoryFlowProject(
  novelFolder: string,
  chapterFile: string
): Promise<any> {
  const response = await fetch(
    `${API_BASE}/storyflow-projects/${encodeURIComponent(
      novelFolder
    )}/${encodeURIComponent(chapterFile)}`,
    {
      method: "DELETE",
    }
  );

  await assertOk(response, "Cannot delete project.");
  return response.json();
}

export async function deleteStoryFlowNovel(novelFolder: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/storyflow-projects/${encodeURIComponent(novelFolder)}`,
    {
      method: "DELETE",
    }
  );

  await assertOk(response, "Cannot delete novel.");
  return response.json();
}
