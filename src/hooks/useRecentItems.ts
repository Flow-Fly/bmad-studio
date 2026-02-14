import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'bmad-studio-recent-items';
const MAX_ITEMS = 10;

export interface RecentStreamItem {
  type: 'stream';
  name: string;
  project: string;
}

export interface RecentArtifactItem {
  type: 'artifact';
  filename: string;
  streamName: string;
  project: string;
}

export type RecentItem = RecentStreamItem | RecentArtifactItem;

function getStoredItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentItem[];
  } catch {
    return [];
  }
}

function setStoredItems(items: RecentItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  // Notify subscribers
  window.dispatchEvent(new Event('bmad-recent-items-change'));
}

function isSameItem(a: RecentItem, b: RecentItem): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'stream' && b.type === 'stream') {
    return a.name === b.name && a.project === b.project;
  }
  if (a.type === 'artifact' && b.type === 'artifact') {
    return a.filename === b.filename && a.streamName === b.streamName && a.project === b.project;
  }
  return false;
}

export function addRecentItem(item: RecentItem): void {
  const current = getStoredItems();
  // Remove duplicate if exists
  const filtered = current.filter((existing) => !isSameItem(existing, item));
  // Add to front, limit to max
  const updated = [item, ...filtered].slice(0, MAX_ITEMS);
  setStoredItems(updated);
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('bmad-recent-items-change', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('bmad-recent-items-change', callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '[]';
}

export function useRecentItems(): {
  recentItems: RecentItem[];
} {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const items: RecentItem[] = (() => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as RecentItem[];
    } catch {
      return [];
    }
  })();

  return { recentItems: items };
}
