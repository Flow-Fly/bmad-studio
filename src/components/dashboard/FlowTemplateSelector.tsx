import { useCallback, useRef } from 'react';
import { GitBranch, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

type FlowType = 'full' | 'quick';

interface FlowTemplateSelectorProps {
  value: FlowType;
  onChange: (type: FlowType) => void;
}

interface FlowOption {
  type: FlowType;
  label: string;
  description: string;
  icon: typeof GitBranch;
}

const FLOW_OPTIONS: FlowOption[] = [
  {
    type: 'full',
    label: 'Full Flow',
    description: '4 phases, all workflow steps',
    icon: GitBranch,
  },
  {
    type: 'quick',
    label: 'Quick Flow',
    description: '2 steps, fast-track with Barry',
    icon: Zap,
  },
];

export function FlowTemplateSelector({ value, onChange }: FlowTemplateSelectorProps) {
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = e.key === 'ArrowLeft' ? 0 : 1;
        const option = FLOW_OPTIONS[nextIndex];
        onChange(option.type);
        cardRefs.current[nextIndex]?.focus();
      }
    },
    [onChange],
  );

  return (
    <div className="flex gap-3" role="radiogroup" aria-label="Flow template">
      {FLOW_OPTIONS.map((option, index) => {
        const isSelected = value === option.type;
        const Icon = option.icon;

        return (
          <button
            key={option.type}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(option.type)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'flex flex-1 cursor-pointer flex-col gap-1.5 rounded-[var(--radius-md)] border px-3 py-3 text-left transition-colors duration-150',
              isSelected
                ? 'border-interactive-accent bg-surface-raised'
                : 'border-surface-border bg-transparent hover:border-surface-border-hover',
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-interactive-muted" />
              <span className="text-[length:var(--text-sm)] font-medium text-interactive-active">
                {option.label}
              </span>
            </div>
            <span className="text-[length:var(--text-xs)] text-interactive-muted">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
