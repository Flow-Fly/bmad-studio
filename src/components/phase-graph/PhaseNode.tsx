import { CircleCheck, CircleDot, Circle, Lock } from 'lucide-react';
import type { PhaseGraphNode as PhaseGraphNodeType, NodeVisualState } from '../../types/phases';
import { formatWorkflowLabel } from '../../lib/phase-utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip';
import { cn } from '../../lib/utils';

const STATE_ICONS: Record<NodeVisualState, React.ComponentType<{ className?: string }>> = {
  current: CircleDot,
  complete: CircleCheck,
  skipped: CircleCheck,
  locked: Lock,
  conditional: Circle,
  required: Circle,
  recommended: Circle,
  optional: Circle,
  'not-started': Circle,
};

interface PhaseNodeProps {
  node: PhaseGraphNodeType;
  visualState: NodeVisualState;
  compact?: boolean;
  focused?: boolean;
  nodeIndex?: number;
  onFocus?: () => void;
}

export function PhaseNode({
  node,
  visualState,
  compact = false,
  focused = false,
  nodeIndex,
  onFocus,
}: PhaseNodeProps) {
  const Icon = STATE_ICONS[visualState];
  const labelText =
    compact && node.label.length > 10
      ? node.label.substring(0, 10)
      : node.label;
  const isLocked = visualState === 'locked';

  const tooltipContent = buildTooltipContent(node, visualState);
  const ariaLabel = buildAriaLabel(node, visualState);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border-primary bg-bg-tertiary px-2 outline-none transition-[border-color,background-color,box-shadow] duration-150 hover:border-accent-hover',
            compact ? 'h-8 w-[90px] px-1.5' : 'h-10 w-[120px]',
            // Visual states
            visualState === 'current' &&
              'border-accent shadow-[0_0_8px_color-mix(in_srgb,var(--bmad-color-accent)_40%,transparent)]',
            visualState === 'complete' && 'border-success bg-success',
            visualState === 'skipped' && 'border-border-primary bg-bg-tertiary',
            visualState === 'locked' &&
              'cursor-not-allowed border-border-primary bg-bg-tertiary opacity-60 hover:border-border-primary',
            visualState === 'conditional' && 'border-warning',
            visualState === 'required' && 'border-accent',
            visualState === 'recommended' && 'border-accent border-dashed',
            visualState === 'optional' && 'border-border-primary border-dashed',
            visualState === 'not-started' && 'border-border-primary',
          )}
          role="button"
          tabIndex={focused ? 0 : -1}
          aria-label={ariaLabel}
          aria-disabled={isLocked || undefined}
          data-node-index={nodeIndex}
          data-workflow-id={node.workflow_id}
          onFocus={onFocus}
        >
          <Icon
            className={cn(
              'shrink-0',
              compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
              // Icon color per state
              visualState === 'current' && 'text-accent',
              visualState === 'complete' && 'text-text-primary',
              visualState === 'skipped' && 'text-text-muted',
              visualState === 'locked' && 'text-text-muted',
              visualState === 'conditional' && 'text-warning',
              visualState === 'required' && 'text-accent',
              visualState === 'recommended' && 'text-accent',
              visualState === 'not-started' && 'text-text-muted',
            )}
          />
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-text-primary',
              compact
                ? 'text-[length:var(--text-xs)]'
                : 'text-[length:var(--text-sm)]',
              // Label color per state
              visualState === 'skipped' && 'text-text-muted line-through',
              visualState === 'locked' && 'text-text-muted',
              visualState === 'optional' && 'text-text-secondary',
              visualState === 'not-started' && 'text-text-muted',
            )}
          >
            {labelText}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

function buildTooltipContent(
  node: PhaseGraphNodeType,
  visualState: NodeVisualState,
): string {
  const parts = [node.label];
  parts.push(`Status: ${visualState}`);
  if (node.agent) {
    parts.push(`Agent: ${node.agent}`);
  }
  if (node.purpose) {
    parts.push(`Purpose: ${node.purpose}`);
  }
  if (visualState === 'locked' && node.unmet_dependencies.length > 0) {
    const depNames = node.unmet_dependencies.map(id => formatWorkflowLabel(id));
    parts.push(`Blocked by: ${depNames.join(', ')}`);
  }
  return parts.join('\n');
}

function getWorkflowTypeName(node: PhaseGraphNodeType): string {
  if (node.is_required) return 'required';
  if (node.is_optional) return 'optional';
  return 'conditional';
}

function buildAriaLabel(
  node: PhaseGraphNodeType,
  visualState: NodeVisualState,
): string {
  let label = `${node.label}, Phase ${node.phase_num}, ${getWorkflowTypeName(node)}, ${visualState}`;
  if (visualState === 'locked' && node.unmet_dependencies.length > 0) {
    const depNames = node.unmet_dependencies.map(id => formatWorkflowLabel(id));
    label += ` — blocked by: ${depNames.join(', ')}`;
  }
  return label;
}
