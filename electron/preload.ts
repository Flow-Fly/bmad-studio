import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  getApiKey: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('keychain:get', provider),

  setApiKey: (provider: string, key: string): Promise<void> =>
    ipcRenderer.invoke('keychain:set', provider, key),

  deleteApiKey: (provider: string): Promise<void> =>
    ipcRenderer.invoke('keychain:delete', provider),
});
