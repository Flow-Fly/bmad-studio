import { create } from 'zustand';
import type { Settings } from '../types/settings';

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;

  // Actions
  setSettings: (settings: Settings) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSettingsState: () => void;
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
}));
