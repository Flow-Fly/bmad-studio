import { useActiveSession } from '../../stores/opencode.store';
import { useStreamStore } from '../../stores/stream.store';
import { Bot } from 'lucide-react';
import { Badge } from '../ui/badge';

export function ConversationHeader() {
  const { streamId } = useActiveSession();
  const streams = useStreamStore((state) => state.streams);

  // Find the active stream to get phase information
  const activeStream = streams.find((s) => s.name === streamId);
  const phaseName = activeStream?.phase ?? 'unknown';
  const workflowName = 'OpenCode Session'; // Prepared for Story 8.3: will come from session launch context

  return (
    <div className="flex items-center gap-3 border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-950">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
        <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>

      <div className="flex flex-col">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {workflowName}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {phaseName}
          </Badge>
        </div>
      </div>
    </div>
  );
}
