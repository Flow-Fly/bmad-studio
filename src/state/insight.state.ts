import { Signal } from 'signal-polyfill';
import type { Insight, InsightStatus } from '../types/insight.js';

export interface InsightFilters {
  status: InsightStatus[];
  tags: string[];
  agentOrigin: string[];
  sortBy: 'recency' | 'used_count' | 'title';
  searchQuery: string;
}

export const insightsState = new Signal.State<Insight[]>([]);

export const insightFilters = new Signal.State<InsightFilters>({
  status: ['fresh', 'used'],
  tags: [],
  agentOrigin: [],
  sortBy: 'recency',
  searchQuery: '',
});

export function addInsight(insight: Insight): void {
  insightsState.set([...insightsState.get(), insight]);
}

export function setInsights(insights: Insight[]): void {
  insightsState.set(insights);
}

export function updateInsightInState(updated: Insight): void {
  insightsState.set(
    insightsState.get().map(i => (i.id === updated.id ? updated : i))
  );
}

export function removeInsight(insightId: string): void {
  insightsState.set(insightsState.get().filter(i => i.id !== insightId));
}

export function clearInsightState(): void {
  insightsState.set([]);
  insightFilters.set({
    status: ['fresh', 'used'],
    tags: [],
    agentOrigin: [],
    sortBy: 'recency',
    searchQuery: '',
  });
}

/**
 * Compute filtered and sorted insights from current state and filters.
 * Called in component render methods that use SignalWatcher.
 */
export function getFilteredInsights(): Insight[] {
  const insights = insightsState.get();
  const filters = insightFilters.get();

  let filtered = insights;

  // Filter by status
  if (filters.status.length > 0) {
    filtered = filtered.filter(i => filters.status.includes(i.status));
  }

  // Filter by tags
  if (filters.tags.length > 0) {
    filtered = filtered.filter(i =>
      filters.tags.some(tag => i.tags.includes(tag))
    );
  }

  // Filter by agent origin
  if (filters.agentOrigin.length > 0) {
    filtered = filtered.filter(i =>
      filters.agentOrigin.includes(i.source_agent)
    );
  }

  // Filter by search query (substring match on title and tags)
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      i =>
        i.title.toLowerCase().includes(query) ||
        i.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Sort
  switch (filters.sortBy) {
    case 'recency':
      filtered = [...filtered].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      break;
    case 'used_count':
      filtered = [...filtered].sort(
        (a, b) => b.used_in_count - a.used_in_count
      );
      break;
    case 'title':
      filtered = [...filtered].sort((a, b) =>
        a.title.localeCompare(b.title)
      );
      break;
  }

  return filtered;
}
