export interface Settings {
  default_provider: string;
  default_model: string;
  ollama_endpoint: string;
  providers: Record<string, ProviderConfig>;
  braveSearchApiKey?: string;
  recent_projects?: ProjectEntry[];
  last_active_project_path?: string;
  default_worktree_creation?: boolean;
  artifact_store_path?: string;
}

export interface ProviderConfig {
  enabled: boolean;
  endpoint?: string;
}

export interface ProjectEntry {
  name: string;
  path: string;
  last_opened: string;
}
