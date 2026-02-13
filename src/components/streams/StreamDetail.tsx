import { GitBranch } from 'lucide-react';

import { useStreamStore } from '@/stores/stream.store';
import { Badge } from '@/components/ui/badge';
import { PhaseDotIndicator } from '@/components/streams/PhaseDotIndicator';
import { formatRelativeTime } from '@/lib/format-utils';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StreamDetail() {
  const activeStreamId = useStreamStore((s) => s.activeStreamId);
  const streams = useStreamStore((s) => s.streams);
  const stream = streams.find((s) => s.name === activeStreamId);

  if (!stream) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-surface-base text-interactive-default">
        <GitBranch className="mb-4 h-12 w-12 text-interactive-muted" />
        <h1 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
          No Stream Selected
        </h1>
        <p className="mt-2 text-[length:var(--text-md)] text-interactive-muted">
          Select a stream from the dashboard to view its details
        </p>
      </div>
    );
  }

  const phaseLabel = stream.phase ? capitalize(stream.phase) : 'No phase data';

  return (
    <div className="flex flex-1 flex-col bg-surface-base">
      {/* Stream header */}
      <div className="border-b border-surface-border px-4 py-3">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 shrink-0 text-interactive-muted" />
          <h1 className="truncate text-[length:var(--text-lg)] font-semibold text-interactive-active">
            {stream.name}
          </h1>
          <Badge variant="outline" className="shrink-0">
            {stream.type === 'full' ? 'Full Flow' : stream.type}
          </Badge>
        </div>
        <div className="mt-1.5 flex items-center gap-3 pl-8">
          <PhaseDotIndicator currentPhase={stream.phase} />
          <span className="text-[length:var(--text-sm)] text-interactive-default">
            {phaseLabel}
          </span>
          <span className="text-[length:var(--text-xs)] text-interactive-muted">
            Updated {formatRelativeTime(stream.updatedAt)}
          </span>
        </div>
      </div>

      {/* Phase graph placeholder — Story 4.5 will replace this */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <GitBranch className="mb-4 h-12 w-12 text-interactive-muted" />
        <p className="text-[length:var(--text-md)] text-interactive-muted">
          Phase graph coming soon
        </p>
      </div>
    </div>
  );
}
