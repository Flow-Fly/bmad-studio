import { create } from 'zustand';

export type SidecarStatus = 'connecting' | 'ready' | 'restarting' | 'error';

interface SidecarState {
  status: SidecarStatus;
  errorMessage: string | null;
  retryCount: number | null;
  port: number | null;

  // Actions
  setStatus: (status: SidecarStatus) => void;
  setError: (message: string) => void;
  setRestarting: (retryCount: number) => void;
  setReady: (port: number) => void;
}

export const useSidecarStore = create<SidecarState>((set) => ({
  status: 'connecting',
  errorMessage: null,
  retryCount: null,
  port: null,

  setStatus: (status) => set({ status }),

  setError: (message) =>
    set({
      status: 'error',
      errorMessage: message,
      retryCount: null,
    }),

  setRestarting: (retryCount) =>
    set({
      status: 'restarting',
      retryCount,
      errorMessage: null,
    }),

  setReady: (port) =>
    set({
      status: 'ready',
      port,
      errorMessage: null,
      retryCount: null,
    }),
}));

// Initialize IPC listeners
let cleanups: (() => void)[] = [];

function registerListeners() {
  cleanups.forEach(fn => fn());
  cleanups = [];

  if (typeof window !== 'undefined' && window.sidecar) {
    cleanups.push(window.sidecar.onStarting(() => {
      useSidecarStore.getState().setStatus('connecting');
    }));

    cleanups.push(window.sidecar.onReady((data) => {
      useSidecarStore.getState().setReady(data.port);
    }));

    cleanups.push(window.sidecar.onRestarting((data) => {
      useSidecarStore.getState().setRestarting(data.retryCount);
    }));

    cleanups.push(window.sidecar.onError((data) => {
      useSidecarStore.getState().setError(data.message);
    }));
  }
}

registerListeners();

if (import.meta.hot) {
  import.meta.hot.dispose(() => cleanups.forEach(fn => fn()));
}

// Selectors
export const useIsReady = () => useSidecarStore((state) => state.status === 'ready');
export const useHasError = () => useSidecarStore((state) => state.status === 'error');
export const useErrorMessage = () => useSidecarStore((state) => state.errorMessage);
export const useSidecarStatus = () => useSidecarStore((state) => state.status);
