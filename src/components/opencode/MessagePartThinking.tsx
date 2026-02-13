import type { ThinkingPart } from '../../types/message';
import { Brain } from 'lucide-react';

interface MessagePartThinkingProps {
  part: ThinkingPart;
}

export function MessagePartThinking({ part }: MessagePartThinkingProps) {
  return (
    <div className="rounded border border-surface-border bg-surface-overlay p-3">
      <div className="mb-2 flex items-center gap-2 text-[length:var(--text-sm)] font-medium text-phase-quickflow-spec">
        <Brain className="h-4 w-4" />
        <span>Thinking...</span>
      </div>
      <p className="text-[length:var(--text-sm)] italic text-interactive-default">
        {part.thinking}
      </p>
    </div>
  );
}
