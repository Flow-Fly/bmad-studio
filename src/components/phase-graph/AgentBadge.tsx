import { cn } from '../../lib/utils';

const AGENT_COLORS: Record<string, string> = {
  mary: 'bg-[var(--agent-mary)]',
  john: 'bg-[var(--agent-john)]',
  winston: 'bg-[var(--agent-winston)]',
  sally: 'bg-[var(--agent-sally)]',
  bob: 'bg-[var(--agent-bob)]',
  amelia: 'bg-[var(--agent-amelia)]',
  barry: 'bg-[var(--agent-barry)]',
};

interface AgentBadgeProps {
  agent: string;
  compact?: boolean;
}

export function AgentBadge({ agent, compact = false }: AgentBadgeProps) {
  const key = agent.toLowerCase();
  const colorClass = AGENT_COLORS[key] ?? 'bg-[var(--interactive-muted)]';
  const initial = agent.length > 0 ? agent.charAt(0).toUpperCase() : '?';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none text-[var(--bg-primary)]',
        compact ? 'h-2.5 w-2.5 text-[6px]' : 'h-3 w-3 text-[7px]',
        colorClass,
      )}
      aria-label={`Agent: ${agent}`}
    >
      {initial}
    </span>
  );
}
