import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';

import type { RegistryEntry } from '@/types/registry';
import type { Stream } from '@/types/stream';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { StreamCard } from '@/components/streams/StreamCard';

interface ProjectOverviewProps {
  project: RegistryEntry;
  streams: Stream[];
  isActive: boolean;
  onSelect: () => void;
  onNavigateToStream: (streamName: string) => void;
  activeStreamId: string | null;
}

export function ProjectOverview({
  project,
  streams,
  isActive,
  onSelect,
  onNavigateToStream,
  activeStreamId,
}: ProjectOverviewProps) {
  const activeStreams = useMemo(
    () =>
      streams
        .filter((s) => s.status === 'active')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [streams],
  );

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-surface-border bg-surface-raised transition-colors duration-150',
        isActive
          ? 'border-l-2 border-l-interactive-accent'
          : 'border-l-2 border-l-transparent hover:border-surface-border-hover',
      )}
    >
      {/* Project Header — clickable to switch project */}
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-interactive-muted transition-transform duration-150',
            isActive && 'rotate-90',
          )}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[length:var(--text-md)] font-semibold text-interactive-active">
            {project.name}
          </h2>
          <p className="mt-0.5 truncate text-[length:var(--text-xs)] text-interactive-muted">
            {project.repoPath}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {activeStreams.length} {activeStreams.length === 1 ? 'stream' : 'streams'}
        </Badge>
      </button>

      {/* Expanded stream list — only shown for active project */}
      {isActive && activeStreams.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-surface-border px-4 py-3">
          {activeStreams.map((stream) => (
            <StreamCard
              key={stream.name}
              stream={stream}
              isActive={stream.name === activeStreamId}
              onClick={() => onNavigateToStream(stream.name)}
            />
          ))}
        </div>
      )}

      {/* Active project with no streams */}
      {isActive && activeStreams.length === 0 && (
        <div className="border-t border-surface-border px-4 py-4 text-center">
          <p className="text-[length:var(--text-sm)] text-interactive-muted">
            No active streams
          </p>
        </div>
      )}
    </div>
  );
}
