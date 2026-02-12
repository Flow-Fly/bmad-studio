import { create } from 'zustand';
import type { ProviderConfig, ProviderType, Model, ValidationStatus } from '../types/provider';
import type { TrustLevel } from '../types/tool';

interface ProviderState {
  trustLevel: TrustLevel;
  providers: ProviderConfig[];
  activeProvider: ProviderType | '';
  selectedModel: string;
  models: Record<string, Model[]>;
  validationStatus: Record<string, ValidationStatus>;

  // Derived
  availableProviders: () => ProviderConfig[];
  activeModels: () => Model[];

  // Actions
  setTrustLevel: (level: TrustLevel) => void;
  updateProviderConfig: (type: ProviderType, updates: Partial<ProviderConfig>) => void;
  setActiveProvider: (type: ProviderType | '') => void;
  setSelectedModel: (model: string) => void;
  setModelsForProvider: (type: string, models: Model[]) => void;
  setValidationStatus: (type: ProviderType, status: Partial<ValidationStatus>) => void;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  trustLevel: 'guided',
  providers: [
    { type: 'claude', enabled: false, hasValidCredentials: false },
    { type: 'openai', enabled: false, hasValidCredentials: false },
    { type: 'ollama', enabled: false, hasValidCredentials: false, endpoint: 'http://localhost:11434' },
    { type: 'gemini', enabled: false, hasValidCredentials: false },
  ],
  activeProvider: '',
  selectedModel: '',
  models: {},
  validationStatus: {},

  availableProviders: () => get().providers.filter(p => p.hasValidCredentials),

  activeModels: () => {
    const active = get().activeProvider;
    if (!active) return [];
    return get().models[active] ?? [];
  },

  setTrustLevel: (trustLevel) => set({ trustLevel }),

  updateProviderConfig: (type, updates) =>
    set(state => ({
      providers: state.providers.map(p =>
        p.type === type ? { ...p, ...updates } : p
      ),
    })),

  setActiveProvider: (activeProvider) => set({ activeProvider }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),

  setModelsForProvider: (type, models) =>
    set(state => ({ models: { ...state.models, [type]: models } })),

  setValidationStatus: (type, status) =>
    set(state => ({
      validationStatus: {
        ...state.validationStatus,
        [type]: { ...{ provider: type, valid: false, loading: false }, ...state.validationStatus[type], ...status },
      },
    })),
}));
