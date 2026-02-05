import type { ProviderType, Model, AppSettings } from '../types/provider.js';
import { getApiKey, setApiKey, hasApiKey } from './keychain.service.js';
import { apiFetch, API_BASE } from './api.service.js';
import { trustLevelState } from '../state/provider.state.js';

interface ValidateResponse {
  valid: boolean;
}

export function friendlyValidationError(type: ProviderType, err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Validation failed';

  // Network error
  if (raw === 'Failed to fetch' || raw.includes('NetworkError')) {
    if (type === 'ollama') {
      return 'Cannot connect to Ollama. Please ensure Ollama is running.';
    }
    return 'Network error. Please check your internet connection and try again.';
  }

  // Provider-specific hints
  if (raw.includes('401') || raw.toLowerCase().includes('invalid') || raw.toLowerCase().includes('auth')) {
    if (type === 'claude') return 'Invalid Claude API key. Check your key at console.anthropic.com.';
    if (type === 'openai') return 'Invalid OpenAI API key. Check your key at platform.openai.com.';
  }

  if (raw.includes('429') || raw.toLowerCase().includes('rate')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (type === 'ollama' && (raw.includes('ECONNREFUSED') || raw.includes('connect'))) {
    return 'Cannot connect to Ollama. Please ensure Ollama is running at the specified endpoint.';
  }

  return raw;
}

export function validateProvider(type: ProviderType, apiKey: string): Promise<ValidateResponse> {
  return apiFetch(`${API_BASE}/providers/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, api_key: apiKey }),
  });
}

export function listModels(type: ProviderType): Promise<Model[]> {
  return apiFetch(`${API_BASE}/providers/${type}/models`);
}

export function loadSettings(): Promise<AppSettings> {
  return apiFetch(`${API_BASE}/settings`);
}

export function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return apiFetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

/**
 * Initialize provider state from persisted settings.
 * Call this at app startup to ensure trust level is loaded before any tool confirmations.
 */
export async function initProviderState(): Promise<void> {
  try {
    const settings = await loadSettings();
    if (settings.trust_level) {
      trustLevelState.set(settings.trust_level);
    }
  } catch {
    // Settings not available — use defaults
  }
}

export { getApiKey, setApiKey, hasApiKey };
