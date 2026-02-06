import { apiFetch, ApiRequestError, API_BASE } from './api.service.js';
import type { OpenProjectResponse } from '../types/project.js';
import {
  setProjectLoading,
  setProjectSuccess,
  setProjectError,
  setRecentProjects,
  setLastActiveProjectPath,
  type RecentProject,
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

interface SettingsResponse {
  recent_projects?: Array<{
    name: string;
    path: string;
    last_opened: string;
  }>;
  last_active_project_path?: string;
}

/**
 * Load recent projects and last active project path from settings.
 * Updates the project state with the fetched data.
 */
export async function loadRecentProjects(): Promise<void> {
  try {
    const settings = await apiFetch<SettingsResponse>(`${API_BASE}/settings`);

    if (settings.recent_projects) {
      const projects: RecentProject[] = settings.recent_projects.map(p => ({
        name: p.name,
        path: p.path,
        lastOpened: p.last_opened,
      }));
      setRecentProjects(projects);
    }

    if (settings.last_active_project_path) {
      setLastActiveProjectPath(settings.last_active_project_path);
    }
  } catch (err) {
    console.warn('[project.service] Failed to load recent projects:', err);
  }
}
