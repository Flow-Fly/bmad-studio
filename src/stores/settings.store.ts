import { create } from 'zustand';
import type { Settings } from '../types/settings';
import {
  fetchSettings as fetchSettingsService,
  updateSettings as updateSettingsService,
} from '../services/settings.service';

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;

  // Actions
  setSettings: (settings: Settings) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSettingsState: () => void;
  fetchSettings: () => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,
  error: null,

  setSettings: (settings) => set({ settings, loading: false, error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearSettingsState: () =>
    set({ settings: null, loading: false, error: null }),

  // Service functions manage loading/error state directly on the store
  fetchSettings: () => fetchSettingsService(),

  updateSettings: (partial: Partial<Settings>) => updateSettingsService(partial),
}));
