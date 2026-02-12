import { useState } from 'react';
import {
  ChevronRight,
  Loader,
  Check,
  X,
  Terminal,
  FileText,
  Search,
} from 'lucide-react';
import type { ToolCallBlock as ToolCallBlockType } from '../../types/tool';
import { cn } from '../../lib/utils';

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bash: Terminal,
  file_read: FileText,
  file_write: FileText,
  web_search: Search,
};

interface ToolCallBlockProps {
  block: ToolCallBlockType;
}

export function ToolCallBlock({ block }: ToolCallBlockProps) {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const ToolIcon = TOOL_ICONS[block.toolName] ?? Terminal;

  const formatInput = () => {
    try {
      return JSON.stringify(block.input, null, 2);
    } catch {
      return block.inputRaw;
    }
  };

  const truncateOutput = (output: string, maxLength = 500) => {
    if (output.length <= maxLength) return output;
    return output.slice(0, maxLength) + '\n... (truncated)';
  };

  const statusConfig = {
    pending: { icon: Loader, label: 'Pending', className: '' },
    running: { icon: Loader, label: 'Running', className: 'animate-spin text-accent' },
    success: { icon: Check, label: 'Complete', className: 'text-success' },
    error: { icon: X, label: 'Failed', className: 'text-error' },
  };

  const status = statusConfig[block.status];
  const StatusIcon = status.icon;

  const hasOutput = block.status === 'success' || block.status === 'error';
  const outputContent = block.error || block.output || '';
  const isError = !!block.error;

  return (
    <div className="my-2 overflow-hidden rounded-[var(--radius-md)] border border-border-secondary bg-bg-tertiary">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border-secondary bg-bg-elevated px-3 py-2">
        <ToolIcon className="h-4 w-4 text-text-tertiary" />
        <span className="font-mono text-[length:var(--text-sm)] font-medium text-text-primary">
          {block.toolName}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <StatusIcon className={cn('h-3.5 w-3.5', status.className)} />
          <span className="text-[length:var(--text-xs)] text-text-tertiary">
            {status.label}
          </span>
        </div>
      </div>

      {/* Input section */}
      <div className="border-t border-border-secondary">
        <button
          className={cn(
            'flex w-full cursor-pointer items-center gap-1 border-none bg-transparent px-3 py-1 text-[length:var(--text-xs)] text-text-tertiary transition-colors hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
          )}
          onClick={() => setInputExpanded(!inputExpanded)}
          aria-expanded={inputExpanded}
        >
          <ChevronRight
            className={cn('h-3 w-3 transition-transform duration-200', inputExpanded && 'rotate-90')}
          />
          <span>Input</span>
        </button>
        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            inputExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <pre className="whitespace-pre-wrap break-words bg-bg-primary px-3 py-2 font-mono text-[length:var(--text-xs)] leading-relaxed text-text-secondary">
            {formatInput()}
          </pre>
        </div>
      </div>

      {/* Output section */}
      {hasOutput && (
        <div className="border-t border-border-secondary">
          <button
            className="flex w-full cursor-pointer items-center gap-1 border-none bg-transparent px-3 py-1 text-[length:var(--text-xs)] text-text-tertiary transition-colors hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            onClick={() => setOutputExpanded(!outputExpanded)}
            aria-expanded={outputExpanded}
          >
            <ChevronRight
              className={cn('h-3 w-3 transition-transform duration-200', outputExpanded && 'rotate-90')}
            />
            <span>{isError ? 'Error' : 'Output'}</span>
          </button>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              outputExpanded ? 'max-h-[500px] opacity-100 overflow-auto' : 'max-h-0 opacity-0',
            )}
          >
            <pre
              className={cn(
                'whitespace-pre-wrap break-words bg-bg-primary px-3 py-2 font-mono text-[length:var(--text-xs)] leading-relaxed',
                isError ? 'text-error' : 'text-text-secondary',
              )}
            >
              {truncateOutput(outputContent)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
