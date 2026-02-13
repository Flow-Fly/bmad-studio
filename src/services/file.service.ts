import { apiFetch, API_BASE } from './api.service';
import type { FileEntry } from '../types/file';

export async function fetchProjectFiles(projectId: string): Promise<FileEntry[]> {
  return apiFetch<FileEntry[]>(`${API_BASE}/projects/${projectId}/files`);
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
