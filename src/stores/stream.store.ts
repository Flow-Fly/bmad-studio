import { create } from 'zustand';
import type { Stream } from '../types/stream';

interface StreamState {
  streams: Stream[];
  activeStreamId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  setStreams: (streams: Stream[]) => void;
  addStream: (stream: Stream) => void;
  updateStream: (name: string, changes: Partial<Stream>) => void;
  removeStream: (name: string) => void;
  setActiveStream: (streamId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearStreamState: () => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  streams: [],
  activeStreamId: null,
  loading: false,
  error: null,

  setStreams: (streams) => set({ streams, loading: false, error: null }),

  addStream: (stream) =>
    set((state) => ({ streams: [...state.streams, stream] })),

  updateStream: (name, changes) =>
    set((state) => ({
      streams: state.streams.map((s) =>
        s.name === name ? { ...s, ...changes } : s,
      ),
    })),

  removeStream: (name) =>
    set((state) => ({
      streams: state.streams.filter((s) => s.name !== name),
    })),

  setActiveStream: (streamId) => set({ activeStreamId: streamId }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearStreamState: () =>
    set({ streams: [], activeStreamId: null, loading: false, error: null }),
}));
