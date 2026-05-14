export const fetchAllProjects = async (): Promise<any[]> => {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed to fetch projects');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

export const saveProjectToServer = async (projectData: any): Promise<void> => {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData)
  });
  if (!res.ok) throw new Error('Failed to save project');
};

export const deleteProjectFromServer = async (id: number | string): Promise<void> => {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
};
