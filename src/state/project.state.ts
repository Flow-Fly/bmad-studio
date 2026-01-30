import { Signal } from 'signal-polyfill';
import type { ProjectData, LoadingState } from '../types/project.js';

// Mutable state signals
export const projectState = new Signal.State<ProjectData | null>(null);
export const projectLoadingState = new Signal.State<LoadingState>({ status: 'idle' });

// Derived computed signals
export const bmadServicesAvailable$ = new Signal.Computed(() => {
  const project = projectState.get();
  return project?.bmadLoaded === true;
});

export const projectName$ = new Signal.Computed(() => {
  const project = projectState.get();
  return project?.projectName ?? null;
});

// State update helpers
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
