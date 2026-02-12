import { create } from 'zustand';
import type { Insight, InsightStatus } from '../types/insight';

export interface InsightFilters {
  status: InsightStatus[];
  tags: string[];
  agentOrigin: string[];
  sortBy: 'recency' | 'used_count' | 'title';
  searchQuery: string;
}

interface InsightState {
  insights: Insight[];
  filters: InsightFilters;

  // Actions
  addInsight: (insight: Insight) => void;
  setInsights: (insights: Insight[]) => void;
  updateInsight: (updated: Insight) => void;
  removeInsight: (insightId: string) => void;
  setFilters: (filters: Partial<InsightFilters>) => void;
  clearInsightState: () => void;

  // Derived
  getFilteredInsights: () => Insight[];
}

const DEFAULT_FILTERS: InsightFilters = {
  status: ['fresh', 'used'],
  tags: [],
  agentOrigin: [],
  sortBy: 'recency',
  searchQuery: '',
};

export const useInsightStore = create<InsightState>((set, get) => ({
  insights: [],
  filters: { ...DEFAULT_FILTERS },

  addInsight: (insight) =>
    set(state => ({ insights: [...state.insights, insight] })),

  setInsights: (insights) => set({ insights }),

  updateInsight: (updated) =>
    set(state => ({
      insights: state.insights.map(i => (i.id === updated.id ? updated : i)),
    })),

  removeInsight: (insightId) =>
    set(state => ({
      insights: state.insights.filter(i => i.id !== insightId),
    })),

  setFilters: (partial) =>
    set(state => ({ filters: { ...state.filters, ...partial } })),

  clearInsightState: () =>
    set({ insights: [], filters: { ...DEFAULT_FILTERS } }),

  getFilteredInsights: () => {
    const { insights, filters } = get();
    let filtered = insights;

    if (filters.status.length > 0) {
      filtered = filtered.filter(i => filters.status.includes(i.status));
    }
    if (filters.tags.length > 0) {
      filtered = filtered.filter(i =>
        filters.tags.some(tag => i.tags.includes(tag))
      );
    }
    if (filters.agentOrigin.length > 0) {
      filtered = filtered.filter(i =>
        filters.agentOrigin.includes(i.source_agent)
      );
    }
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        i =>
          i.title.toLowerCase().includes(query) ||
          i.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    switch (filters.sortBy) {
      case 'recency':
        filtered = [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case 'used_count':
        filtered = [...filtered].sort((a, b) => b.used_in_count - a.used_in_count);
        break;
      case 'title':
        filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return filtered;
  },
}));
