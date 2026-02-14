import { apiFetch, API_BASE } from './api.service';
import type { ArtifactInfo } from '../types/artifact';

export async function listArtifacts(
  projectId: string,
  streamId: string,
): Promise<ArtifactInfo[]> {
  const compositeId = `${projectId}-${streamId}`;
  return apiFetch<ArtifactInfo[]>(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams/${encodeURIComponent(compositeId)}/artifacts`,
  );
}

export async function readArtifact(
  projectId: string,
  streamId: string,
  artifactPath: string,
): Promise<string> {
  const compositeId = `${projectId}-${streamId}`;
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams/${encodeURIComponent(compositeId)}/artifacts/${artifactPath}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to read artifact: ${response.statusText}`);
  }
  return response.text();
}

export async function listDirectoryArtifacts(
  projectId: string,
  streamId: string,
  dirPath: string,
): Promise<ArtifactInfo[]> {
  const compositeId = `${projectId}-${streamId}`;
  return apiFetch<ArtifactInfo[]>(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams/${encodeURIComponent(compositeId)}/artifacts/${dirPath}`,
  );
}
