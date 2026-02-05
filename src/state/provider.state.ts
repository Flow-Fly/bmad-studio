import { Signal } from 'signal-polyfill';
import type { ProviderConfig, ProviderType, Model, ValidationStatus } from '../types/provider.js';
import type { TrustLevel } from '../types/tool.js';

// Mutable state signals
export const trustLevelState = new Signal.State<TrustLevel>('guided');

export const providersState = new Signal.State<ProviderConfig[]>([
  { type: 'claude', enabled: false, hasValidCredentials: false },
  { type: 'openai', enabled: false, hasValidCredentials: false },
  { type: 'ollama', enabled: false, hasValidCredentials: false, endpoint: 'http://localhost:11434' },
]);

export const activeProviderState = new Signal.State<ProviderType | ''>('');
export const selectedModelState = new Signal.State<string>('');
export const modelsState = new Signal.State<Record<string, Model[]>>({});
export const validationState = new Signal.State<Record<string, ValidationStatus>>({});

// Derived computed signals
export const availableProviders$ = new Signal.Computed(() =>
  providersState.get().filter(p => p.hasValidCredentials)
);

export const activeModels$ = new Signal.Computed(() => {
  const active = activeProviderState.get();
  if (!active) return [];
  return modelsState.get()[active] ?? [];
});

// State update helpers
export function updateProviderConfig(type: ProviderType, updates: Partial<ProviderConfig>): void {
  const current = providersState.get();
  providersState.set(
    current.map(p => (p.type === type ? { ...p, ...updates } : p))
  );
}

export function setModelsForProvider(type: string, models: Model[]): void {
  const current = modelsState.get();
  modelsState.set({ ...current, [type]: models });
}

export function setValidationStatus(type: ProviderType, status: Partial<ValidationStatus>): void {
  const current = validationState.get();
  validationState.set({
    ...current,
    [type]: { provider: type, valid: false, loading: false, ...current[type], ...status },
  });
}
