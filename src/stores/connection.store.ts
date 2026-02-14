import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export type InternetStatus = 'online' | 'offline';

interface ConnectionState {
  status: ConnectionStatus;
  internetStatus: InternetStatus;
  setStatus: (status: ConnectionStatus) => void;
  setInternetStatus: (status: InternetStatus) => void;
  initConnectivityMonitoring: () => void;
  cleanupConnectivityMonitoring: () => void;
}

// Store listener references for cleanup
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  internetStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  setStatus: (status) => set({ status }),
  setInternetStatus: (status) => set({ internetStatus: status }),
  initConnectivityMonitoring: () => {
    // Set initial state
    set({ internetStatus: navigator.onLine ? 'online' : 'offline' });

    // Clean up any existing listeners
    if (onlineHandler) window.removeEventListener('online', onlineHandler);
    if (offlineHandler) window.removeEventListener('offline', offlineHandler);

    // Register new listeners
    onlineHandler = () => set({ internetStatus: 'online' });
    offlineHandler = () => set({ internetStatus: 'offline' });
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
  },
  cleanupConnectivityMonitoring: () => {
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler);
      onlineHandler = null;
    }
    if (offlineHandler) {
      window.removeEventListener('offline', offlineHandler);
      offlineHandler = null;
    }
  },
}));

// Selectors
export const useIsOffline = () =>
  useConnectionStore((s) => s.internetStatus === 'offline');

export const useInternetStatus = () =>
  useConnectionStore((s) => s.internetStatus);
