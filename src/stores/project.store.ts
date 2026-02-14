import { create } from 'zustand';
import type { ProjectData, LoadingState } from '../types/project';
import type { RegistryEntry } from '../types/registry';

export interface RecentProject {
  name: string;
  path: string;
  lastOpened: string;
}

interface ProjectState {
  project: ProjectData | null;
  loadingState: LoadingState;
  recentProjects: RecentProject[];
  lastActiveProjectPath: string | null;
  registeredProjects: RegistryEntry[];
  activeProjectName: string | null;

  // Derived
  bmadServicesAvailable: () => boolean;
  projectName: () => string | null;

  // Actions
  setProjectLoading: () => void;
  setProjectSuccess: (data: ProjectData) => void;
  setProjectError: (message: string, code?: string) => void;
  clearProject: () => void;
  setRecentProjects: (projects: RecentProject[]) => void;
  setLastActiveProjectPath: (path: string | null) => void;
  setRegisteredProjects: (projects: RegistryEntry[]) => void;
  setActiveProject: (name: string) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  loadingState: { status: 'idle' },
  recentProjects: [],
  lastActiveProjectPath: null,
  registeredProjects: [],
  activeProjectName: null,

  bmadServicesAvailable: () => get().project?.bmadLoaded === true,
  projectName: () => get().project?.projectName ?? null,

  setProjectLoading: () => set({ loadingState: { status: 'loading' } }),

  setProjectSuccess: (data) =>
    set({ project: data, loadingState: { status: 'success' }, activeProjectName: data.projectName }),

  setProjectError: (message, code) =>
    set({ project: null, loadingState: { status: 'error', error: message, errorCode: code } }),

  clearProject: () =>
    set({ project: null, loadingState: { status: 'idle' } }),

  setRecentProjects: (recentProjects) => set({ recentProjects }),
  setLastActiveProjectPath: (lastActiveProjectPath) => set({ lastActiveProjectPath }),
  setRegisteredProjects: (registeredProjects) => set({ registeredProjects }),
  setActiveProject: (name) => set({ activeProjectName: name }),
}));
