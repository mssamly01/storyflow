import path from 'path';
import fs from 'fs/promises';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'project-storage',
          configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
              const projectsDir = path.resolve(__dirname, 'projects');
              const storyflowDir = path.join(projectsDir, 'storyflow');
              const literaryDir = path.join(projectsDir, 'literary');
              
              // Ensure directories exist
              for (const dir of [projectsDir, storyflowDir, literaryDir]) {
                try {
                  await fs.access(dir);
                } catch {
                  await fs.mkdir(dir, { recursive: true });
                }
              }

              if (req.url === '/api/projects' && req.method === 'GET') {
                try {
                  const projects = [];
                  
                  // Read from root (for legacy), storyflow, and literary
                  const dirsToRead = [projectsDir, storyflowDir, literaryDir];
                  for (const dir of dirsToRead) {
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
                    } catch (e) {
                      // Directory might not exist yet or other read error
                    }
                  }

                  // Sort by timestamp or id descending
                  projects.sort((a, b) => (b.id || 0) - (a.id || 0));
                  
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(projects));
                } catch (error) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to read projects' }));
                }
                return;
              }

              if (req.url === '/api/config' && req.method === 'GET') {
                try {
                  const configPath = path.join(projectsDir, 'user_config.json');
                  let config = {};
                  try {
                    const content = await fs.readFile(configPath, 'utf-8');
                    config = JSON.parse(content);
                  } catch (e) {
                    // File not found or invalid, return default
                  }
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(config));
                } catch (error) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to read config' }));
                }
                return;
              }

              if (req.url === '/api/config' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', async () => {
                  try {
                    const config = JSON.parse(body);
                    const configPath = path.join(projectsDir, 'user_config.json');
                    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                  } catch (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'Failed to save config' }));
                  }
                });
                return;
              }

              if (req.url === '/api/projects' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', async () => {
                  try {
                    const project = JSON.parse(body);
                    const slugify = (str: string) => {
                      return str
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[đĐ]/g, 'd')
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_+|_+$/g, '');
                    };

                    if (project.type === 'literary') {
                      const fileName = `${slugify(project.title)}.json`;
                      const filePath = path.join(literaryDir, fileName);
                      
                      let existingProject;
                      try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        existingProject = JSON.parse(content);
                        
                        // Merge logic for literary chapters
                        if (project.chapters && project.chapters.length > 0) {
                          const newChapter = project.chapters[0];
                          const chapterIndex = existingProject.chapters.findIndex((c: any) => c.chapter === newChapter.chapter);
                          
                          if (chapterIndex >= 0) {
                            existingProject.chapters[chapterIndex] = newChapter;
                          } else {
                            existingProject.chapters.push(newChapter);
                          }
                          existingProject.lastUpdated = new Date().toISOString();
                        }
                      } catch (e) {
                        // File doesn't exist, use the project as is
                        existingProject = project;
                      }
                      
                      await fs.writeFile(filePath, JSON.stringify(existingProject, null, 2));
                    } else {
                      // Storyflow storage
                      const fileName = `${slugify(project.inputData.title)}_${slugify(project.inputData.chapter)}.json`;
                      await fs.writeFile(path.join(storyflowDir, fileName), JSON.stringify(project, null, 2));
                    }
                    
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                  } catch (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'Failed to save project' }));
                  }
                });
                return;
              }

              if (req.url?.startsWith('/api/projects/') && req.method === 'DELETE') {
                const idOrFilename = req.url.split('/').pop();
                try {
                  const dirsToSearch = [projectsDir, storyflowDir, literaryDir];
                  let deleted = false;

                  for (const dir of dirsToSearch) {
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
                    } catch (e) {}
                  }

                  if (deleted) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                  } else {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: 'Project not found' }));
                  }
                } catch (error) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to delete project' }));
                }
                return;
              }
              next();
            });
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
