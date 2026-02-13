import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { cn } from '../../lib/utils';

interface ConditionalGateProps {
  label: string;
  isOpen: boolean;
  compact?: boolean;
}

export function ConditionalGate({ label, isOpen, compact = false }: ConditionalGateProps) {
  const tooltipText = isOpen
    ? `Gate "${label}" is open — condition met`
    : `Gate "${label}" is closed — condition not yet met`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex flex-col items-center gap-1',
            compact && 'gap-0.5',
          )}
          role="img"
          aria-label={tooltipText}
        >
          {/* Diamond shape */}
          <div
            className={cn(
              'flex items-center justify-center',
              compact ? 'h-5 w-5' : 'h-6 w-6',
            )}
          >
            <div
              className={cn(
                'rotate-45 border-2',
                compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
                isOpen
                  ? 'border-success bg-success/20'
                  : 'border-warning bg-warning/20',
              )}
            />
          </div>
          {/* Gate label */}
          <span
            className={cn(
              'text-center text-text-secondary',
              compact
                ? 'text-[9px] leading-tight'
                : 'text-[length:var(--text-xs)] leading-tight',
            )}
          >
            {label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
