import { useActiveSession } from '../../stores/opencode.store';
import { useStreamStore } from '../../stores/stream.store';
import { Bot } from 'lucide-react';
import { Badge } from '../ui/badge';
import { CostSummary } from './CostSummary';

export function ConversationHeader() {
  const { streamId } = useActiveSession();
  const streams = useStreamStore((state) => state.streams);

  const activeStream = streams.find((s) => s.name === streamId);
  const phaseName = activeStream?.phase ?? 'unknown';
  const workflowName = 'OpenCode Session';

  return (
    <div className="flex items-center gap-3 border-b border-surface-border bg-surface-raised p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-interactive-accent/15">
        <Bot className="h-5 w-5 text-interactive-accent" />
      </div>

      <div className="flex flex-col">
        <h2 className="text-[length:var(--text-sm)] font-semibold text-interactive-active">
          {workflowName}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {phaseName}
          </Badge>
        </div>
      </div>

      <div className="ml-auto">
        <CostSummary />
      </div>
    </div>
  );
}
