import type {
  PhaseCompletionStatus,
  WorkflowCompletionStatus,
  WorkflowStatusValue,
} from '../../types/workflow';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../ui/tooltip';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

const STATUS_BADGE_VARIANT: Record<WorkflowStatusValue, BadgeVariant> = {
  complete: 'success',
  required: 'default',
  not_started: 'secondary',
  optional: 'secondary',
  skipped: 'secondary',
  recommended: 'default',
  conditional: 'warning',
};

const STATUS_LABELS: Record<WorkflowStatusValue, string> = {
  complete: 'Complete',
  required: 'Required',
  not_started: 'Not Started',
  optional: 'Optional',
  skipped: 'Skipped',
  recommended: 'Recommended',
  conditional: 'Conditional',
};

// NOTE: Workflow status data sources will be wired in Story 4-5 (Phase Graph Rendering).
// Until then, this component renders a placeholder message.

export function WorkflowStatusDisplay() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <p className="text-[length:var(--text-md)] leading-relaxed text-text-secondary">
        No workflow status available — run a BMAD workflow to begin tracking
        progress
      </p>
    </div>
  );
}

function PhaseRow({
  phase,
  isCurrent,
}: {
  phase: PhaseCompletionStatus;
  isCurrent: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-border-primary bg-bg-secondary px-6 py-4 transition-[border-color] duration-150',
        isCurrent && 'border-accent',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[length:var(--text-md)] font-medium text-text-primary">
          {phase.name}
        </span>
        <span className="text-[length:var(--text-sm)] text-text-secondary">
          {phase.completed_count}/{phase.total_required}
        </span>
      </div>
      <Progress value={phase.percent_complete} />
    </div>
  );
}

function WorkflowItem({ workflow }: { workflow: WorkflowCompletionStatus }) {
  const variant = STATUS_BADGE_VARIANT[workflow.status];
  const label = STATUS_LABELS[workflow.status];
  const tooltipText = workflow.artifact_path
    ? `${label} — ${workflow.artifact_path}`
    : label;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[length:var(--text-sm)] text-text-secondary">
        {workflow.workflow_id}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge variant={variant}>{label}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function renderSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[720px] p-8">
      <div className="flex flex-col gap-4">
        <div className="animate-pulse rounded-[var(--radius-md)] border border-border-primary bg-bg-secondary p-6">
          <div className="mb-2 h-3.5 w-[40%] rounded-[var(--radius-sm)] bg-bg-tertiary" />
          <div className="h-3.5 w-[65%] rounded-[var(--radius-sm)] bg-bg-tertiary" />
        </div>
        <div className="animate-pulse rounded-[var(--radius-md)] border border-border-primary bg-bg-secondary p-6">
          <div className="mb-2 h-3.5 w-[40%] rounded-[var(--radius-sm)] bg-bg-tertiary" />
          <div className="mb-4 h-1.5 w-full rounded-[var(--radius-sm)] bg-bg-tertiary" />
          <div className="h-3.5 w-[65%] rounded-[var(--radius-sm)] bg-bg-tertiary" />
        </div>
        <div className="animate-pulse rounded-[var(--radius-md)] border border-border-primary bg-bg-secondary p-6">
          <div className="mb-2 h-3.5 w-[40%] rounded-[var(--radius-sm)] bg-bg-tertiary" />
          <div className="mb-4 h-1.5 w-full rounded-[var(--radius-sm)] bg-bg-tertiary" />
          <div className="h-3.5 w-[65%] rounded-[var(--radius-sm)] bg-bg-tertiary" />
        </div>
      </div>
    </div>
  );
}
