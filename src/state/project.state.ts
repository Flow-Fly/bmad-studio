import { Signal } from 'signal-polyfill';
import type { ProjectData, LoadingState } from '../types/project.js';

export interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}

export const projectState = new Signal.State<ProjectData | null>(null);
export const projectLoadingState = new Signal.State<LoadingState>({ status: 'idle' });
export const recentProjectsState = new Signal.State<RecentProject[]>([]);
export const lastActiveProjectPath = new Signal.State<string | null>(null);

export const bmadServicesAvailable$ = new Signal.Computed(() => {
  const project = projectState.get();
  return project?.bmadLoaded === true;
});

export const projectName$ = new Signal.Computed(() => {
  const project = projectState.get();
  return project?.projectName ?? null;
});

export function setProjectLoading(): void {
  projectLoadingState.set({ status: 'loading' });
}

export function setProjectSuccess(data: ProjectData): void {
  projectState.set(data);
  projectLoadingState.set({ status: 'success' });
}

export function setProjectError(message: string, code?: string): void {
  projectState.set(null);
  projectLoadingState.set({ status: 'error', error: message, errorCode: code });
}

export function clearProject(): void {
  projectState.set(null);
  projectLoadingState.set({ status: 'idle' });
}

export function setRecentProjects(projects: RecentProject[]): void {
  recentProjectsState.set(projects);
}

export function setLastActiveProjectPath(path: string | null): void {
  lastActiveProjectPath.set(path);
}
