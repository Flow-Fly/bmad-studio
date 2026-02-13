import { useState } from 'react';
import type { ToolCallPart } from '../../types/message';
import { Wrench, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MessagePartToolCallProps {
  part: ToolCallPart;
}

export function MessagePartToolCall({ part }: MessagePartToolCallProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-surface-border bg-surface-overlay">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-surface-raised"
      >
        <Wrench className="h-4 w-4 text-interactive-default" />
        <span className="font-medium text-interactive-active">
          {part.toolName}
        </span>
        <ChevronDown
          className={cn(
            'ml-auto h-4 w-4 text-interactive-default transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="border-t border-surface-border p-3">
          <pre className="overflow-x-auto rounded bg-surface-sunken p-2 font-mono text-[length:var(--text-xs)] text-interactive-default">
            {JSON.stringify(part.args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
