import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const projectsDir = path.resolve(__dirname, 'projects');
const storyflowDir = path.join(projectsDir, 'storyflow');
const literaryDir = path.join(projectsDir, 'literary');

const ensureDirs = async () => {
  for (const dir of [projectsDir, storyflowDir, literaryDir]) {
    try { await fs.access(dir); } catch { await fs.mkdir(dir, { recursive: true }); }
  }
};

const slugify = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');

// GET /api/projects
app.get('/api/projects', async (_req, res) => {
  await ensureDirs();
  try {
    const projects: any[] = [];
    for (const dir of [projectsDir, storyflowDir, literaryDir]) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          if (stat.isFile() && file.endsWith('.json') && file !== 'user_config.json') {
            const content = await fs.readFile(filePath, 'utf-8');
            projects.push(JSON.parse(content));
          }
        }
      } catch { /* dir may not exist */ }
    }
    projects.sort((a, b) => (b.id || 0) - (a.id || 0));
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Failed to read projects' });
  }
});

// POST /api/projects
app.post('/api/projects', async (req, res) => {
  await ensureDirs();
  try {
    const project = req.body;
    if (project.type === 'literary') {
      const fileName = `${slugify(project.title)}.json`;
      const filePath = path.join(literaryDir, fileName);
      let existingProject;
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        existingProject = JSON.parse(content);
        if (project.chapters?.length > 0) {
          const newChapter = project.chapters[0];
          const idx = existingProject.chapters.findIndex((c: any) => c.chapter === newChapter.chapter);
          if (idx >= 0) existingProject.chapters[idx] = newChapter;
          else existingProject.chapters.push(newChapter);
          existingProject.lastUpdated = new Date().toISOString();
        }
      } catch { existingProject = project; }
      await fs.writeFile(filePath, JSON.stringify(existingProject, null, 2));
    } else {
      const fileName = `${slugify(project.inputData.title)}_${slugify(project.inputData.chapter)}.json`;
      await fs.writeFile(path.join(storyflowDir, fileName), JSON.stringify(project, null, 2));
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', async (req, res) => {
  await ensureDirs();
  const idOrFilename = req.params.id;
  try {
    let deleted = false;
    for (const dir of [projectsDir, storyflowDir, literaryDir]) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(dir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const project = JSON.parse(content);
            if (String(project.id) === idOrFilename || file === idOrFilename || file === `${idOrFilename}.json`) {
              await fs.unlink(filePath);
              deleted = true;
              break;
            }
          }
        }
        if (deleted) break;
      } catch { /* ignore */ }
    }
    if (deleted) res.json({ success: true });
    else res.status(404).json({ error: 'Project not found' });
  } catch {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/config
app.get('/api/config', async (_req, res) => {
  await ensureDirs();
  try {
    const configPath = path.join(projectsDir, 'user_config.json');
    let config = {};
    try { config = JSON.parse(await fs.readFile(configPath, 'utf-8')); } catch { /* default */ }
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// POST /api/config
app.post('/api/config', async (req, res) => {
  await ensureDirs();
  try {
    const configPath = path.join(projectsDir, 'user_config.json');
    await fs.writeFile(configPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
