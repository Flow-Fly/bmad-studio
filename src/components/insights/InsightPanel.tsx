import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useInsightStore } from '../../stores/insight.store';
import type { InsightFilters } from '../../stores/insight.store';
import { useProjectStore } from '../../stores/project.store';
import type { Insight, InsightStatus } from '../../types/insight';
import {
  fetchInsights,
  updateInsight,
  deleteInsight,
} from '../../services/insight.service';
import { InsightCard } from './InsightCard';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';

interface InsightPanelProps {
  onInsightInject?: (insightId: string) => void;
}

export function InsightPanel({ onInsightInject }: InsightPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insights = useInsightStore(s => s.insights);
  const filters = useInsightStore(s => s.filters);
  const getFilteredInsights = useInsightStore(s => s.getFilteredInsights);
  const setFilters = useInsightStore(s => s.setFilters);
  const project = useProjectStore(s => s.project);

  const filtered = getFilteredInsights();
  const usedCount = insights.filter(i => i.status === 'used').length;
  const archivedCount = insights.filter(i => i.status === 'archived').length;

  // Load insights on mount
  useEffect(() => {
    if (!project) return;
    fetchInsights(project.projectName).catch(err => {
      console.warn(
        'Failed to load insights:',
        err instanceof Error ? err.message : err,
      );
    });
  }, [project]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        setFilters({ searchQuery: value });
      }, 200);
    },
    [setFilters],
  );

  const handleSortChange = useCallback(
    (value: string) => {
      setFilters({ sortBy: value as InsightFilters['sortBy'] });
    },
    [setFilters],
  );

  const toggleStatusFilter = useCallback(
    (status: InsightStatus) => {
      const current = useInsightStore.getState().filters.status;
      const updated = current.includes(status)
        ? current.filter(s => s !== status)
        : [...current, status];
      setFilters({ status: updated });
    },
    [setFilters],
  );

  const handleCardToggle = useCallback((insightId: string) => {
    setExpandedId(prev => (prev === insightId ? null : insightId));
  }, []);

  const handleInsightUpdate = useCallback(
    async (updated: Insight) => {
      if (!project) return;
      try {
        await updateInsight(project.projectName, updated);
      } catch (err) {
        console.warn(
          'Failed to update insight:',
          err instanceof Error ? err.message : err,
        );
      }
    },
    [project],
  );

  const handleInsightArchive = useCallback(
    async (insightId: string) => {
      if (!project) return;
      const insight = useInsightStore
        .getState()
        .insights.find(i => i.id === insightId);
      if (!insight) return;
      try {
        await updateInsight(project.projectName, {
          ...insight,
          status: 'archived',
        });
      } catch (err) {
        console.warn(
          'Failed to archive insight:',
          err instanceof Error ? err.message : err,
        );
      }
    },
    [project],
  );

  const handleInsightDelete = useCallback(
    async (insightId: string) => {
      if (!project) return;
      try {
        await deleteInsight(project.projectName, insightId);
        if (expandedId === insightId) setExpandedId(null);
      } catch (err) {
        console.warn(
          'Failed to delete insight:',
          err instanceof Error ? err.message : err,
        );
      }
    },
    [project, expandedId],
  );

  const handleInsightInject = useCallback(
    (insightId: string) => {
      onInsightInject?.(insightId);
    },
    [onInsightInject],
  );

  const renderStatusChip = (status: InsightStatus) => {
    const isActive = filters.status.includes(status);
    return (
      <button
        key={status}
        className={cn(
          'cursor-pointer rounded-full border border-border-primary bg-transparent px-2 py-0.5 text-[length:var(--text-xs)] text-text-secondary transition-colors hover:bg-bg-tertiary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          isActive && 'border-accent bg-accent text-bg-primary',
        )}
        aria-pressed={isActive}
        onClick={() => toggleStatusFilter(status)}
      >
        {status}
      </button>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-bg-primary text-text-primary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary bg-bg-secondary px-4 py-3">
        <span className="text-[length:var(--text-lg)] font-semibold">
          Insights
        </span>
        <Select value={filters.sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recency">Recent</SelectItem>
            <SelectItem value="used_count">Most Used</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 border-b border-border-secondary px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search insights..."
            defaultValue={filters.searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8"
            aria-label="Search insights"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {renderStatusChip('fresh')}
          {renderStatusChip('used')}
          {renderStatusChip('archived')}
        </div>
      </div>

      {/* Card list */}
      {insights.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-text-muted">
          No Insights yet. Compact a conversation to create your first.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-text-muted">
          No Insights match your filters.
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" role="list">
          {filtered.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              expanded={expandedId === insight.id}
              onToggle={() => handleCardToggle(insight.id)}
              onInject={handleInsightInject}
              onUpdate={handleInsightUpdate}
              onArchive={handleInsightArchive}
              onDelete={handleInsightDelete}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border-primary px-4 py-2 text-[length:var(--text-xs)] text-text-tertiary">
        {insights.length > 0 && (
          <span>
            {insights.length} insight{insights.length !== 1 ? 's' : ''} &middot;{' '}
            {usedCount} used &middot; {archivedCount} archived
          </span>
        )}
      </div>
    </div>
  );
}
