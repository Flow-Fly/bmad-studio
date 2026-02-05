import type { TrustLevel } from './tool.js';

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
  supports_tools: boolean;
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
  trust_level: TrustLevel;
}

export interface ProviderSettingsEntry {
  enabled: boolean;
  endpoint?: string;
}
