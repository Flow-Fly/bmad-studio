import { apiFetch, ApiRequestError, API_BASE } from './api.service.js';
import type { OpenProjectResponse } from '../types/project.js';
import {
  setProjectLoading,
  setProjectSuccess,
  setProjectError,
} from '../state/project.state.js';

export async function openProject(folderPath: string): Promise<void> {
  setProjectLoading();
  try {
    const data = await apiFetch<OpenProjectResponse>(`${API_BASE}/projects/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath }),
    });
    setProjectSuccess({
      projectName: data.project_name,
      projectRoot: data.project_root,
      bmadLoaded: data.bmad_loaded,
      services: data.services,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = err instanceof ApiRequestError ? err.code : undefined;
    setProjectError(message, code);
  }
}

export async function loadBmadConfig(): Promise<OpenProjectResponse> {
  return apiFetch<OpenProjectResponse>(`${API_BASE}/bmad/config`);
}

export async function loadBmadStatus(): Promise<unknown> {
  return apiFetch<unknown>(`${API_BASE}/bmad/status`);
}
