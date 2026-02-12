import type { ProviderType } from '../types/provider';

const SERVICE_NAME = 'bmad-studio';

function keyNameFor(provider: ProviderType): string {
  return `${provider}-api-key`;
}

function localStorageKeyFor(provider: ProviderType): string {
  return `${SERVICE_NAME}-${provider}-api-key`;
}

interface ElectronAPI {
  getApiKey: (provider: string) => Promise<string | null>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  deleteApiKey: (provider: string) => Promise<void>;
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    return (window as unknown as { electronAPI: ElectronAPI }).electronAPI;
  }
  return null;
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

const memoryStore = new Map<string, string>();
let warnedAboutFallback = false;
let warnedAboutLocalStorage = false;

function warnFallback(): void {
  if (!warnedAboutFallback) {
    console.warn('[keychain] Electron API not available — using in-memory storage (keys will not persist)');
    warnedAboutFallback = true;
  }
}

function warnLocalStorage(): void {
  if (!warnedAboutLocalStorage) {
    console.info('[keychain] Electron API not available — using localStorage (keys persist across refreshes)');
    warnedAboutLocalStorage = true;
  }
}

export async function getApiKey(provider: ProviderType): Promise<string | null> {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    try {
      return await electronAPI.getApiKey(provider);
    } catch (err) {
      console.error(`[keychain] Failed to read key for ${provider}:`, err);
    }
  }
  if (isLocalStorageAvailable()) {
    warnLocalStorage();
    return localStorage.getItem(localStorageKeyFor(provider));
  }
  warnFallback();
  return memoryStore.get(keyNameFor(provider)) ?? null;
}

export async function setApiKey(provider: ProviderType, key: string): Promise<void> {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    try {
      await electronAPI.setApiKey(provider, key);
      return;
    } catch {
      console.warn('[keychain] Electron save failed, falling back to localStorage');
    }
  }
  if (isLocalStorageAvailable()) {
    warnLocalStorage();
    localStorage.setItem(localStorageKeyFor(provider), key);
    return;
  }
  warnFallback();
  memoryStore.set(keyNameFor(provider), key);
}

export async function deleteApiKey(provider: ProviderType): Promise<void> {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    try {
      await electronAPI.deleteApiKey(provider);
      return;
    } catch (err) {
      console.error(`[keychain] Failed to delete key for ${provider}:`, err);
    }
  }
  if (isLocalStorageAvailable()) {
    warnLocalStorage();
    localStorage.removeItem(localStorageKeyFor(provider));
    return;
  }
  warnFallback();
  memoryStore.delete(keyNameFor(provider));
}

export async function hasApiKey(provider: ProviderType): Promise<boolean> {
  const key = await getApiKey(provider);
  return key !== null && key.length > 0;
}
