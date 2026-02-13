import type { Stream } from '@/types/stream';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PhaseDotIndicator } from '@/components/streams/PhaseDotIndicator';
import { formatRelativeTime } from '@/lib/format-utils';

/**
 * Map a phase name to its Tailwind border-l color class for the active card indicator.
 */
const PHASE_BORDER_CLASSES: Record<string, string> = {
  analysis: 'border-l-phase-analysis',
  planning: 'border-l-phase-planning',
  solutioning: 'border-l-phase-solutioning',
  implementation: 'border-l-phase-implementation',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface StreamCardProps {
  stream: Stream;
  isActive: boolean;
  onClick: () => void;
}

export function StreamCard({ stream, isActive, onClick }: StreamCardProps) {
  const activeBorderClass = stream.phase
    ? PHASE_BORDER_CLASSES[stream.phase] ?? 'border-l-interactive-accent'
    : 'border-l-interactive-accent';

  const phaseLabel = stream.phase ? capitalize(stream.phase) : 'No phase data';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer flex-col gap-1.5 rounded-[var(--radius-md)] border border-surface-border bg-surface-raised px-3 py-2.5 text-left transition-colors duration-150 hover:border-surface-border-hover',
        isActive
          ? `border-l-2 ${activeBorderClass} bg-surface-overlay`
          : 'border-l-2 border-l-transparent',
      )}
    >
      {/* Row 1: Stream name + flow type badge */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate text-[length:var(--text-sm)] font-medium text-interactive-active">
              {stream.name}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{stream.name}</TooltipContent>
        </Tooltip>
        <Badge variant="outline" className="ml-auto shrink-0">
          {stream.type === 'full' ? 'Full Flow' : stream.type}
        </Badge>
      </div>

      {/* Row 2: Project name */}
      <span className="truncate text-[length:var(--text-xs)] text-interactive-muted">
        {stream.project}
      </span>

      {/* Row 3: Phase dots + phase label + timestamp */}
      <div className="flex items-center gap-2">
        <PhaseDotIndicator currentPhase={stream.phase} />
        <span className="text-[length:var(--text-xs)] text-interactive-default">
          {phaseLabel}
        </span>
        <span className="ml-auto shrink-0 text-[length:var(--text-xs)] text-interactive-muted">
          {formatRelativeTime(stream.updatedAt)}
        </span>
      </div>
    </button>
  );
}
