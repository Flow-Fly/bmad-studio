import { apiFetch, API_BASE } from './api.service';
import { useStreamStore } from '../stores/stream.store';
import type { Stream } from '../types/stream';

export async function fetchStreams(projectId: string): Promise<void> {
  const store = useStreamStore.getState();
  store.setLoading(true);
  try {
    const streams = await apiFetch<Stream[]>(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams`,
    );
    store.setStreams(streams);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch streams';
    store.setError(message);
  }
}

export async function createStream(
  projectId: string,
  name: string,
): Promise<Stream | null> {
  const store = useStreamStore.getState();
  store.setLoading(true);
  try {
    const stream = await apiFetch<Stream>(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      },
    );
    store.addStream(stream);
    store.setLoading(false);
    return stream;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create stream';
    store.setError(message);
    return null;
  }
}

export async function getStream(
  projectId: string,
  streamId: string,
): Promise<Stream | null> {
  try {
    const compositeId = `${projectId}-${streamId}`;
    return await apiFetch<Stream>(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams/${encodeURIComponent(compositeId)}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get stream';
    useStreamStore.getState().setError(message);
    return null;
  }
}

export async function archiveStream(
  projectId: string,
  streamId: string,
  outcome: 'merged' | 'abandoned',
): Promise<void> {
  const store = useStreamStore.getState();
  try {
    const compositeId = `${projectId}-${streamId}`;
    await apiFetch<void>(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams/${encodeURIComponent(compositeId)}/archive`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      },
    );
    store.updateStream(streamId, { status: 'archived', outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to archive stream';
    store.setError(message);
  }
}

export async function updateStream(
  projectId: string,
  streamId: string,
  updates: Partial<Stream>,
): Promise<void> {
  const store = useStreamStore.getState();
  try {
    const compositeId = `${projectId}-${streamId}`;
    await apiFetch<Stream>(
      `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams/${encodeURIComponent(compositeId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      },
    );
    store.updateStream(streamId, updates);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update stream';
    store.setError(message);
  }
}

interface WorktreeResult {
  branch: string;
  worktreePath: string;
}

export async function createStreamWithWorktree(
  projectId: string,
  name: string,
  createWorktree: boolean,
): Promise<Stream | null> {
  const store = useStreamStore.getState();

  // Step 1: Create the stream
  const stream = await createStream(projectId, name);
  if (!stream) {
    return null;
  }

  // Step 2: Optionally create worktree
  if (createWorktree) {
    const compositeId = `${projectId}-${name}`;
    try {
      const result = await apiFetch<WorktreeResult>(
        `${API_BASE}/projects/${encodeURIComponent(projectId)}/streams/${encodeURIComponent(compositeId)}/worktree`,
        { method: 'POST' },
      );
      // Update store with worktree info
      store.updateStream(name, {
        branch: result.branch,
        worktree: result.worktreePath,
      });
      return { ...stream, branch: result.branch, worktree: result.worktreePath };
    } catch (err) {
      // Worktree failure is non-fatal — stream is still created
      console.warn('Worktree creation failed:', err instanceof Error ? err.message : err);
      return stream;
    }
  }

  return stream;
}
