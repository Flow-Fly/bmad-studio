import { apiFetch, ApiRequestError, API_BASE } from './api.service';
import type { OpenProjectResponse } from '../types/project';
import { useProjectStore, type RecentProject } from '../stores/project.store';

export async function openProject(folderPath: string): Promise<void> {
  const store = useProjectStore.getState();
  store.setProjectLoading();
  try {
    const data = await apiFetch<OpenProjectResponse>(`${API_BASE}/projects/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath }),
    });
    store.setProjectSuccess({
      projectName: data.project_name,
      projectRoot: data.project_root,
      bmadLoaded: data.bmad_loaded,
      services: data.services,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const code = err instanceof ApiRequestError ? err.code : undefined;
    store.setProjectError(message, code);
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

export async function loadRecentProjects(): Promise<void> {
  try {
    const settings = await apiFetch<SettingsResponse>(`${API_BASE}/settings`);
    const store = useProjectStore.getState();

    if (settings.recent_projects) {
      const projects: RecentProject[] = settings.recent_projects.map(p => ({
        name: p.name,
        path: p.path,
        lastOpened: p.last_opened,
      }));
      store.setRecentProjects(projects);
    }

    if (settings.last_active_project_path) {
      store.setLastActiveProjectPath(settings.last_active_project_path);
    }
  } catch (err) {
    console.warn('[project.service] Failed to load recent projects:', err);
  }
}
