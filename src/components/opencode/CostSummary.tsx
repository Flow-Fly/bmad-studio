import { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { useSessionCosts } from '../../stores/opencode.store';
import { formatCost, formatTokenCount, aggregateCostEntries } from '../../lib/cost-utils';

/**
 * Displays a compact cost summary for the current OpenCode session.
 *
 * Self-hiding: renders nothing if no cost data is available.
 * Placed in the ConversationHeader to provide at-a-glance usage info.
 */
export function CostSummary() {
  const sessionCosts = useSessionCosts();
  const summary = useMemo(() => aggregateCostEntries(sessionCosts), [sessionCosts]);

  // Graceful degradation: render nothing if no cost data
  if (!summary) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Coins className="h-3.5 w-3.5" />
      <span>
        {formatTokenCount(summary.totalInputTokens)} in /{' '}
        {formatTokenCount(summary.totalOutputTokens)} out
      </span>
      {summary.totalEstimatedCost !== null && (
        <span className="font-medium">
          {formatCost(summary.totalEstimatedCost)}
        </span>
      )}
    </div>
  );
}
