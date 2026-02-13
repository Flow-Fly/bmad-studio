import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import type { ToolCallPart } from '../../types/message';
import { Wrench, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MessagePartToolCallProps {
  part: ToolCallPart;
}

export function MessagePartToolCall({ part }: MessagePartToolCallProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="rounded border border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
    >
      <Collapsible.Trigger className="flex w-full items-center gap-2 p-3 text-left hover:bg-gray-200 dark:hover:bg-gray-700">
        <Wrench className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {part.toolName}
        </span>
        <ChevronDown
          className={cn(
            'ml-auto h-4 w-4 text-gray-600 transition-transform dark:text-gray-400',
            open && 'rotate-180'
          )}
        />
      </Collapsible.Trigger>

      <Collapsible.Content className="border-t border-gray-300 p-3 dark:border-gray-700">
        <pre className="overflow-x-auto rounded bg-gray-50 p-2 font-mono text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
          {JSON.stringify(part.input, null, 2)}
        </pre>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
