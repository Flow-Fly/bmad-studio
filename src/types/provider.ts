export type ProviderType = 'claude' | 'openai' | 'ollama';

export interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  hasValidCredentials: boolean;
  endpoint?: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  max_tokens: number;
}

export interface ValidationStatus {
  provider: ProviderType;
  valid: boolean;
  message?: string;
  loading: boolean;
}

export interface AppSettings {
  default_provider: string;
  default_model: string;
  ollama_endpoint: string;
  providers: Record<string, ProviderSettingsEntry>;
}

export interface ProviderSettingsEntry {
  enabled: boolean;
  endpoint?: string;
}
