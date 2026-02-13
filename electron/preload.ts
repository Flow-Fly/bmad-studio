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

contextBridge.exposeInMainWorld('sidecar', {
  onStarting: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('sidecar:starting', listener);
    return () => ipcRenderer.removeListener('sidecar:starting', listener);
  },

  onReady: (callback: (data: { port: number }) => void) => {
    const listener = (_event: unknown, data: { port: number }) => callback(data);
    ipcRenderer.on('sidecar:ready', listener);
    return () => ipcRenderer.removeListener('sidecar:ready', listener);
  },

  onRestarting: (callback: (data: { retryCount: number }) => void) => {
    const listener = (_event: unknown, data: { retryCount: number }) => callback(data);
    ipcRenderer.on('sidecar:restarting', listener);
    return () => ipcRenderer.removeListener('sidecar:restarting', listener);
  },

  onError: (callback: (data: { code: string; message: string }) => void) => {
    const listener = (_event: unknown, data: { code: string; message: string }) =>
      callback(data);
    ipcRenderer.on('sidecar:error', listener);
    return () => ipcRenderer.removeListener('sidecar:error', listener);
  },
});
