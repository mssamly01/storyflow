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
    let detail = text.trim();

    if (detail) {
      try {
        const parsed = JSON.parse(detail);
        detail = parsed?.error || parsed?.message || detail;
      } catch {
        // Keep the raw server response when it is not JSON.
      }
    }

    const serverHint = response.status === 500 && !detail
      ? " Co the server luu du an chua chay. Hay khoi dong bang start-storyflow.bat hoac npm run dev."
      : "";

    throw new Error(
      `${fallbackMessage} (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""})${detail ? `: ${detail}` : ""}.${serverHint}`
    );
  }
}

export async function loadStoryFlowProjects(): Promise<StoryFlowProjectLibrary> {
  const response = await fetch(`${API_BASE}/storyflow-projects`);
  await assertOk(response, "Khong the tai thu vien du an");
  return response.json();
}

export async function saveStoryFlowProject(project: any): Promise<any> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/storyflow-projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(project),
    });
  } catch (err: any) {
    throw new Error(
      `Khong the ket noi server luu du an. Hay khoi dong bang start-storyflow.bat hoac npm run dev. ${err?.message || err || ""}`.trim()
    );
  }

  await assertOk(response, "Khong the luu du an");
  return response.json();
}

export async function openStoryFlowProject(novelFolder: string, chapterFile: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/storyflow-projects/${encodeURIComponent(
      novelFolder
    )}/${encodeURIComponent(chapterFile)}`
  );

  await assertOk(response, "Khong the mo du an");
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

  await assertOk(response, "Khong the xoa chuong");
  return response.json();
}

export async function deleteStoryFlowNovel(novelFolder: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/storyflow-projects/${encodeURIComponent(novelFolder)}`,
    {
      method: "DELETE",
    }
  );

  await assertOk(response, "Khong the xoa truyen");
  return response.json();
}
