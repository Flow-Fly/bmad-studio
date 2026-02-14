import { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { useSessionCosts } from '../../stores/opencode.store';
import { formatCost, formatTokenCount } from '../../lib/cost-utils';
import type { StreamCostSummary } from '../../types/ipc';

/**
 * Displays a compact cost summary for the current OpenCode session.
 *
 * Self-hiding: renders nothing if no cost data is available (AC #4).
 * Placed in the ConversationHeader to provide at-a-glance usage info.
 */
export function CostSummary() {
  const sessionCosts = useSessionCosts();

  const summary: StreamCostSummary | null = useMemo(() => {
    if (sessionCosts.length === 0) return null;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalEstimatedCost: number | null = 0;
    const sessionIds = new Set<string>();

    for (const entry of sessionCosts) {
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;
      sessionIds.add(entry.sessionId);

      if (entry.estimatedCost !== null && totalEstimatedCost !== null) {
        totalEstimatedCost += entry.estimatedCost;
      } else {
        totalEstimatedCost = null;
      }
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalEstimatedCost,
      sessionCount: sessionIds.size,
      entries: sessionCosts,
    };
  }, [sessionCosts]);

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
