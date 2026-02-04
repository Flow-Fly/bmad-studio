import type { FileEntry } from '../types/file.js';

const API_BASE = 'http://localhost:3008/api/v1';

export async function fetchProjectFiles(projectId: string): Promise<FileEntry[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/files`);
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch files: ${errorText}`);
  }
  return response.json();
}

export async function fetchFileContent(projectId: string, filePath: string): Promise<string> {
  const encoded = encodeURIComponent(filePath);
  const response = await fetch(`${API_BASE}/projects/${projectId}/files/${encoded}`);
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch file content: ${errorText}`);
  }
  return response.text();
}
