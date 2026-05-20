import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";

const app = express();

const PORT = Number(process.env.STORYFLOW_SERVER_PORT || 4177);
const PROJECT_DIR = path.resolve(process.cwd(), "projects");

app.use(cors());
app.use(express.json({ limit: "100mb" }));

async function ensureProjectDir() {
  await fs.mkdir(PROJECT_DIR, { recursive: true });
}

function safeSlug(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 100) || "untitled";
}

function padChapter(chapter: string | number | undefined) {
  const raw = String(chapter || "1").trim();
  const numeric = Number(raw);

  if (Number.isFinite(numeric) && raw !== "") {
    return String(numeric).padStart(3, "0");
  }

  return safeSlug(raw || "1");
}

function getNovelFolderName(project: any) {
  return safeSlug(
    project?.inputData?.title ||
      project?.title ||
      project?.storyFlowProject?.title ||
      "untitled-novel"
  );
}

function getChapterFileName(project: any) {
  const chapter =
    project?.inputData?.chapter ||
    project?.chapter ||
    project?.storyFlowProject?.chapter ||
    "1";

  return `chapter-${padChapter(chapter)}.storyflow.json`;
}

function getProjectPaths(project: any) {
  const novelFolder = getNovelFolderName(project);
  const chapterFile = getChapterFileName(project);

  const novelDir = path.join(PROJECT_DIR, novelFolder);
  const chapterPath = path.join(novelDir, chapterFile);
  const metaPath = path.join(novelDir, "novel.meta.json");

  return {
    novelFolder,
    chapterFile,
    novelDir,
    chapterPath,
    metaPath,
    relativePath: `${novelFolder}/${chapterFile}`,
  };
}

function safePathPart(value: string) {
  return path.basename(value);
}

async function readJsonFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "storyflow-project-server",
    projectDir: PROJECT_DIR,
  });
});

app.get("/api/storyflow-projects", async (_req, res) => {
  try {
    await ensureProjectDir();

    const entries = await fs.readdir(PROJECT_DIR, { withFileTypes: true });
    const novels: any[] = [];

    for (const entry of entries) {
      // Allow directories, ignore generic files. But we also skip standard folders like 'literary' if we wish.
      // Wait, let's keep all directories.
      if (!entry.isDirectory()) continue;

      const novelFolder = entry.name;
      // Skip the built-in non-storyflow directories if they exist, or read them if they contain .storyflow.json files.
      const novelDir = path.join(PROJECT_DIR, novelFolder);

      const files = await fs.readdir(novelDir).catch(() => [] as string[]);
      const chapters: any[] = [];

      for (const file of files) {
        if (!file.endsWith(".storyflow.json")) continue;

        try {
          const project = await readJsonFile(path.join(novelDir, file));

          chapters.push({
            chapterId: project.chapterId || file.replace(".storyflow.json", ""),
            chapter: project.inputData?.chapter || project.chapter || "",
            chapterTitle: project.inputData?.chapterTitle || "",
            fileName: file,
            relativePath: `${novelFolder}/${file}`,
            updatedAt: project.updatedAt || project.timestamp || "",
            createdAt: project.createdAt || "",
            hasFinalResult: Boolean(project.production?.finalResult),
            hasStoryboard: Boolean(project.production?.storyboard),
            hasPrompts: Boolean(project.production?.prompts),
          });
        } catch {
          // Skip invalid project file.
        }
      }

      if (chapters.length === 0 && novelFolder === "literary") {
        // Skip default literary folder if no storyflow projects inside
        continue;
      }

      chapters.sort((a, b) => {
        const chapterA = Number(a.chapter);
        const chapterB = Number(b.chapter);

        if (Number.isFinite(chapterA) && Number.isFinite(chapterB)) {
          return chapterA - chapterB;
        }

        return String(a.chapter).localeCompare(String(b.chapter));
      });

      let title = novelFolder;
      let updatedAt = "";

      try {
        const meta = await readJsonFile(path.join(novelDir, "novel.meta.json"));
        title = meta.title || title;
        updatedAt = meta.updatedAt || "";
      } catch {
        const firstChapter = chapters[0];
        title = firstChapter?.chapterTitle
          ? `${novelFolder} (${firstChapter.chapterTitle})`
          : firstChapter?.chapter
          ? `${novelFolder} - Chapter ${firstChapter.chapter}`
          : novelFolder;
      }

      if (!updatedAt && chapters.length > 0) {
        // Fallback to the latest chapter's updatedAt
        const sortedByDate = [...chapters].sort((a, b) =>
          String(b.updatedAt).localeCompare(String(a.updatedAt))
        );
        updatedAt = sortedByDate[0]?.updatedAt || "";
      }

      novels.push({
        novelId: novelFolder,
        folderName: novelFolder,
        title,
        updatedAt: updatedAt || new Date().toISOString(),
        chapters,
      });
    }

    novels.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

    res.json({ novels });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/storyflow-projects/:novelFolder/:chapterFile", async (req, res) => {
  try {
    await ensureProjectDir();

    const novelFolder = safePathPart(req.params.novelFolder);
    const chapterFile = safePathPart(req.params.chapterFile);

    if (!chapterFile.endsWith(".storyflow.json")) {
      return res.status(400).json({ error: "Invalid chapter file." });
    }

    const filePath = path.join(PROJECT_DIR, novelFolder, chapterFile);
    const project = await readJsonFile(filePath);

    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/storyflow-projects", async (req, res) => {
  try {
    await ensureProjectDir();

    const project = req.body;
    const now = new Date().toISOString();

    const paths = getProjectPaths(project);

    await fs.mkdir(paths.novelDir, { recursive: true });

    const existingProject = await readJsonFile(paths.chapterPath).catch(() => null);

    const projectToSave = {
      ...project,
      type: "storyflow.chapter",
      version: 1,
      novelId: paths.novelFolder,
      chapterId: paths.chapterFile.replace(".storyflow.json", ""),
      chapterFile: paths.chapterFile,
      relativePath: paths.relativePath,
      createdAt: project.createdAt || existingProject?.createdAt || now,
      updatedAt: now,
    };

    const meta = {
      type: "storyflow.novel",
      version: 1,
      novelId: paths.novelFolder,
      title:
        project?.inputData?.title ||
        project?.title ||
        project?.storyFlowProject?.title ||
        "Chưa đặt tên",
      createdAt: existingProject?.createdAt || now,
      updatedAt: now,
    };

    await fs.writeFile(paths.metaPath, JSON.stringify(meta, null, 2), "utf-8");
    await fs.writeFile(
      paths.chapterPath,
      JSON.stringify(projectToSave, null, 2),
      "utf-8"
    );

    res.json({
      ok: true,
      novelFolder: paths.novelFolder,
      chapterFile: paths.chapterFile,
      relativePath: paths.relativePath,
      project: projectToSave,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/storyflow-projects/:novelFolder", async (req, res) => {
  try {
    await ensureProjectDir();

    const novelFolder = safePathPart(req.params.novelFolder);
    const novelDir = path.join(PROJECT_DIR, novelFolder);

    await fs.rm(novelDir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/storyflow-projects/:novelFolder/:chapterFile", async (req, res) => {
  try {
    await ensureProjectDir();

    const novelFolder = safePathPart(req.params.novelFolder);
    const chapterFile = safePathPart(req.params.chapterFile);

    if (!chapterFile.endsWith(".storyflow.json")) {
      return res.status(400).json({ error: "Invalid chapter file." });
    }

    const novelDir = path.join(PROJECT_DIR, novelFolder);
    const filePath = path.join(novelDir, chapterFile);
    await fs.rm(filePath, { force: true });

    // Check if there are any other .storyflow.json files in this folder
    const files = await fs.readdir(novelDir).catch(() => [] as string[]);
    const hasChapters = files.some(file => file.endsWith(".storyflow.json"));
    if (!hasChapters) {
      await fs.rm(novelDir, { recursive: true, force: true });
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Storyflow project server running at http://localhost:${PORT}`);
  console.log(`Project folder: ${PROJECT_DIR}`);
});
