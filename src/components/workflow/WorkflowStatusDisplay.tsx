import { useWorkflowStore } from '../../stores/workflow.store';
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

export function WorkflowStatusDisplay() {
  const workflowStatus = useWorkflowStore(s => s.workflowStatus);
  const loadingState = useWorkflowStore(s => s.loadingState);
  const currentPhase = useWorkflowStore(s => s.currentPhase);
  const phaseCompletions = useWorkflowStore(s => s.phaseCompletions);
  const nextWorkflow = useWorkflowStore(s => s.nextWorkflow);

  if (loadingState.status === 'loading') {
    return renderSkeleton();
  }

  if (loadingState.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-[length:var(--text-md)] text-error">
          {loadingState.error ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!workflowStatus) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-[length:var(--text-md)] leading-relaxed text-text-secondary">
          No workflow status available — run a BMAD workflow to begin tracking
          progress
        </p>
      </div>
    );
  }

  const phase = currentPhase();
  const phases = phaseCompletions();
  const next = nextWorkflow();
  const workflows = Object.values(workflowStatus.workflow_statuses);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mx-auto w-full max-w-[720px] p-8">
        {/* Summary card */}
        <div className="mb-8 rounded-[var(--radius-md)] border border-border-primary bg-bg-secondary p-6">
          <p className="mb-2 text-[length:var(--text-lg)] font-semibold text-accent">
            Phase {phase?.num ?? '?'} of {phases.length} —{' '}
            {phase?.name ?? 'Unknown'}
          </p>
          {next ? (
            <p className="text-[length:var(--text-md)] leading-normal text-text-secondary">
              Next:{' '}
              <span className="font-medium text-text-primary">{next.id}</span> (
              {next.agent})
            </p>
          ) : (
            <p className="text-[length:var(--text-md)] leading-normal text-text-secondary">
              All workflows complete
            </p>
          )}
        </div>

        {/* Phase rows */}
        <div className="flex flex-col gap-4">
          {phases.map(p => (
            <PhaseRow
              key={p.phase_num}
              phase={p}
              isCurrent={p.phase_num === phase?.num}
            />
          ))}
        </div>

        {/* Workflows list */}
        {workflows.length > 0 && (
          <div className="mt-6 rounded-[var(--radius-md)] border border-border-primary bg-bg-secondary px-6 py-4">
            <p className="mb-2 text-[length:var(--text-md)] font-medium text-text-primary">
              Workflows
            </p>
            <div className="flex flex-col gap-1">
              {workflows.map(w => (
                <WorkflowItem key={w.workflow_id} workflow={w} />
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
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
