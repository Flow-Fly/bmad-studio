import { apiFetch, API_BASE } from './api.service';
import { useSettingsStore } from '../stores/settings.store';
import type { Settings } from '../types/settings';

export async function fetchSettings(): Promise<void> {
  const store = useSettingsStore.getState();
  store.setLoading(true);
  try {
    const settings = await apiFetch<Settings>(`${API_BASE}/settings`);
    store.setSettings(settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch settings';
    store.setError(message);
  }
}

export async function updateSettings(
  partial: Partial<Settings>,
): Promise<void> {
  const store = useSettingsStore.getState();
  store.setLoading(true);
  try {
    const updated = await apiFetch<Settings>(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
    store.setSettings(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update settings';
    store.setError(message);
  }
}
