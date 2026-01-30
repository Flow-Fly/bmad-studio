import type { ProviderType } from '../types/provider.js';

const SERVICE_NAME = 'bmad-studio';

function keyNameFor(provider: ProviderType): string {
  return `${provider}-api-key`;
}

function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// In-memory fallback for dev mode (no Tauri context)
const memoryStore = new Map<string, string>();
let warnedAboutFallback = false;

function warnFallback(): void {
  if (!warnedAboutFallback) {
    console.warn('[keychain] Tauri keyring not available — using in-memory storage (keys will not persist)');
    warnedAboutFallback = true;
  }
}

export async function getApiKey(provider: ProviderType): Promise<string | null> {
  if (isTauriAvailable()) {
    try {
      const { getPassword } = await import('tauri-plugin-keyring-api');
      return await getPassword(SERVICE_NAME, keyNameFor(provider));
    } catch (err) {
      console.error(`[keychain] Failed to read key for ${provider}:`, err);
      return null;
    }
  }
  warnFallback();
  return memoryStore.get(keyNameFor(provider)) ?? null;
}

export async function setApiKey(provider: ProviderType, key: string): Promise<void> {
  if (isTauriAvailable()) {
    try {
      const { setPassword } = await import('tauri-plugin-keyring-api');
      await setPassword(SERVICE_NAME, keyNameFor(provider), key);
      return;
    } catch {
      throw new Error('Could not save API key to system keychain. Please check your OS keychain settings.');
    }
  }
  warnFallback();
  memoryStore.set(keyNameFor(provider), key);
}

export async function deleteApiKey(provider: ProviderType): Promise<void> {
  if (isTauriAvailable()) {
    try {
      const { deletePassword } = await import('tauri-plugin-keyring-api');
      await deletePassword(SERVICE_NAME, keyNameFor(provider));
      return;
    } catch (err) {
      console.error(`[keychain] Failed to delete key for ${provider}:`, err);
      return;
    }
  }
  warnFallback();
  memoryStore.delete(keyNameFor(provider));
}

/** Check if a key exists without returning the key value */
export async function hasApiKey(provider: ProviderType): Promise<boolean> {
  const key = await getApiKey(provider);
  return key !== null && key.length > 0;
}
