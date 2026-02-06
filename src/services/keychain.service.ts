import type { ProviderType } from '../types/provider.js';
import { getPassword, setPassword, deletePassword } from 'tauri-plugin-keyring-api';

const SERVICE_NAME = 'bmad-studio';

function keyNameFor(provider: ProviderType): string {
  return `${provider}-api-key`;
}

function localStorageKeyFor(provider: ProviderType): string {
  return `${SERVICE_NAME}-${provider}-api-key`;
}

function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// In-memory fallback for dev mode (no Tauri context, no localStorage)
const memoryStore = new Map<string, string>();
let warnedAboutFallback = false;
let warnedAboutLocalStorage = false;

function warnFallback(): void {
  if (!warnedAboutFallback) {
    console.warn('[keychain] Tauri keyring not available — using in-memory storage (keys will not persist)');
    warnedAboutFallback = true;
  }
}

function warnLocalStorage(): void {
  if (!warnedAboutLocalStorage) {
    console.info('[keychain] Tauri keyring not available — using localStorage (keys persist across refreshes)');
    warnedAboutLocalStorage = true;
  }
}

export async function getApiKey(provider: ProviderType): Promise<string | null> {
  if (isTauriAvailable()) {
    try {
      return await getPassword(SERVICE_NAME, keyNameFor(provider));
    } catch (err) {
      console.error(`[keychain] Failed to read key for ${provider}:`, err);
      // Fall through to localStorage/memory fallback
    }
  }
  // localStorage fallback for dev mode (persists across refreshes)
  if (isLocalStorageAvailable()) {
    warnLocalStorage();
    return localStorage.getItem(localStorageKeyFor(provider));
  }
  // Final fallback: in-memory (lost on refresh)
  warnFallback();
  return memoryStore.get(keyNameFor(provider)) ?? null;
}

export async function setApiKey(provider: ProviderType, key: string): Promise<void> {
  if (isTauriAvailable()) {
    try {
      await setPassword(SERVICE_NAME, keyNameFor(provider), key);
      return;
    } catch {
      // Fall through to localStorage/memory fallback
      console.warn('[keychain] Keyring save failed, falling back to localStorage');
    }
  }
  // localStorage fallback for dev mode (persists across refreshes)
  if (isLocalStorageAvailable()) {
    warnLocalStorage();
    localStorage.setItem(localStorageKeyFor(provider), key);
    return;
  }
  // Final fallback: in-memory (lost on refresh)
  warnFallback();
  memoryStore.set(keyNameFor(provider), key);
}

export async function deleteApiKey(provider: ProviderType): Promise<void> {
  if (isTauriAvailable()) {
    try {
      await deletePassword(SERVICE_NAME, keyNameFor(provider));
      return;
    } catch (err) {
      console.error(`[keychain] Failed to delete key for ${provider}:`, err);
      // Fall through to localStorage/memory fallback
    }
  }
  // localStorage fallback for dev mode
  if (isLocalStorageAvailable()) {
    warnLocalStorage();
    localStorage.removeItem(localStorageKeyFor(provider));
    return;
  }
  // Final fallback: in-memory
  warnFallback();
  memoryStore.delete(keyNameFor(provider));
}

/** Check if a key exists without returning the key value */
export async function hasApiKey(provider: ProviderType): Promise<boolean> {
  const key = await getApiKey(provider);
  return key !== null && key.length > 0;
}
