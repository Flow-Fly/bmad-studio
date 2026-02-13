import type { ThinkingPart } from '../../types/message';
import { Brain } from 'lucide-react';

interface MessagePartThinkingProps {
  part: ThinkingPart;
}

export function MessagePartThinking({ part }: MessagePartThinkingProps) {
  return (
    <div className="rounded border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
        <Brain className="h-4 w-4" />
        <span>Thinking...</span>
      </div>
      <p className="text-sm italic text-purple-600 dark:text-purple-400">
        {part.thinking}
      </p>
    </div>
  );
}
