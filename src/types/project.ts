export interface ServiceAvailability {
  config: boolean;
  phases: boolean;
  agents: boolean;
  status: boolean;
  artifacts: boolean;
  watcher: boolean;
}

export interface ProjectData {
  projectName: string;
  projectRoot: string;
  bmadLoaded: boolean;
  services: ServiceAvailability;
}

export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingState {
  status: LoadingStatus;
  error?: string;
  errorCode?: string;
}

export interface OpenProjectResponse {
  project_name: string;
  project_root: string;
  bmad_loaded: boolean;
  services: {
    config: boolean;
    phases: boolean;
    agents: boolean;
    status: boolean;
    artifacts: boolean;
    watcher: boolean;
  };
}

export interface ProjectErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
