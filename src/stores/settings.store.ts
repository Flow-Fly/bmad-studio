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

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      await fetchSettingsService();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch settings';
      set({ error: message, loading: false });
    }
  },

  updateSettings: async (partial: Partial<Settings>) => {
    set({ loading: true, error: null });
    try {
      await updateSettingsService(partial);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update settings';
      set({ error: message, loading: false });
    }
  },
}));
