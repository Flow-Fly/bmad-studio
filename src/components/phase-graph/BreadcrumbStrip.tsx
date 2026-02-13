import { CircleCheck, CircleDot, Circle } from 'lucide-react';
import type { PhasesResponse } from '../../types/phases';
import type { WorkflowStatus } from '../../types/workflow';
import { AgentBadge } from './AgentBadge';
import { formatWorkflowLabel, DEV_LOOP_IDS } from '../../lib/phase-utils';
import { cn } from '../../lib/utils';

/** Phase name -> CSS custom property color */
const PHASE_COLORS: Record<string, string> = {
  Analysis: 'var(--phase-analysis)',
  Planning: 'var(--phase-planning)',
  Solutioning: 'var(--phase-solutioning)',
  Implementation: 'var(--phase-implementation)',
};

interface BreadcrumbStripProps {
  phases: PhasesResponse;
  workflowStatus: WorkflowStatus;
  onExpand: () => void;
}

type PhaseStatus = 'complete' | 'active' | 'future';

function getPhaseStatus(
  phaseNum: number,
  currentPhase: number,
  percentComplete: number,
): PhaseStatus {
  if (percentComplete >= 100) return 'complete';
  if (phaseNum === currentPhase) return 'active';
  if (phaseNum < currentPhase) return 'complete';
  return 'future';
}

function buildAriaLabel(
  phases: PhasesResponse,
  workflowStatus: WorkflowStatus,
): string {
  const parts = phases.phases.map((phase) => {
    const completion = workflowStatus.phase_completion.find(
      (pc) => pc.phase_num === phase.phase,
    );
    const percent = completion?.percent_complete ?? 0;
    const status = getPhaseStatus(
      phase.phase,
      workflowStatus.current_phase,
      percent,
    );
    let statusLabel: string;
    switch (status) {
      case 'complete': statusLabel = 'complete'; break;
      case 'active': statusLabel = 'in progress'; break;
      default: statusLabel = 'pending';
    }
    return `${phase.name} ${statusLabel}`;
  });
  return `Phase graph breadcrumb: ${parts.join(', ')}. Click to expand.`;
}

export function BreadcrumbStrip({
  phases,
  workflowStatus,
  onExpand,
}: BreadcrumbStripProps) {
  const isQuickFlow =
    phases.track === 'quick' || phases.phases.length <= 2;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExpand();
    }
  };

  const ariaLabel = buildAriaLabel(phases, workflowStatus);

  // Find the active workflow label and agent
  const activeWorkflowId = workflowStatus.next_workflow_id;
  const activeAgent = workflowStatus.next_workflow_agent;
  const activeWorkflowLabel = activeWorkflowId
    ? formatWorkflowLabel(activeWorkflowId)
    : null;

  // Find which phase the active workflow belongs to
  let activeWorkflowPhaseNum = workflowStatus.current_phase;
  if (activeWorkflowId) {
    for (const phase of phases.phases) {
      if (phase.workflows.some((wf) => wf.id === activeWorkflowId)) {
        activeWorkflowPhaseNum = phase.phase;
        break;
      }
    }
  }

  if (isQuickFlow) {
    return (
      <div
        className="flex h-9 cursor-pointer items-center gap-2 border-b border-surface-border bg-surface-raised px-4 transition-colors duration-150 hover:bg-surface-overlay"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={onExpand}
        onKeyDown={handleKeyDown}
      >
        <span className="text-[length:var(--text-xs)] font-semibold text-interactive-default">
          Quick Flow
        </span>
        <span className="text-[length:var(--text-xs)] text-interactive-muted">
          |
        </span>
        {phases.phases.map((phase, idx) => {
          const color =
            idx === 0
              ? 'var(--phase-quickflow-spec)'
              : 'var(--phase-quickflow-dev)';
          const completion = workflowStatus.phase_completion.find(
            (pc) => pc.phase_num === phase.phase,
          );
          const percent = completion?.percent_complete ?? 0;
          const status = getPhaseStatus(
            phase.phase,
            workflowStatus.current_phase,
            percent,
          );

          return (
            <div
              key={phase.phase}
              className="flex items-center gap-1.5"
              style={{ borderLeft: `2px solid ${color}`, paddingLeft: '6px' }}
            >
              {status === 'complete' && (
                <CircleCheck className="h-3 w-3 text-status-complete" />
              )}
              {status === 'active' && (
                <CircleDot className="h-3 w-3 animate-pulse text-status-active" />
              )}
              {status === 'future' && (
                <Circle className="h-3 w-3 text-interactive-muted" />
              )}
              <span
                className={cn(
                  'text-[length:var(--text-xs)]',
                  status === 'future'
                    ? 'text-interactive-muted opacity-60'
                    : 'text-interactive-default',
                )}
              >
                {phase.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Full flow breadcrumb
  return (
    <div
      className="flex h-9 cursor-pointer items-center border-b border-surface-border bg-surface-raised transition-colors duration-150 hover:bg-surface-overlay"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onExpand}
      onKeyDown={handleKeyDown}
    >
      {phases.phases
        .filter((phase) => {
          // Exclude phases that only contain dev loop workflows
          const nonDevWorkflows = phase.workflows.filter(
            (wf) => !DEV_LOOP_IDS.has(wf.id),
          );
          return nonDevWorkflows.length > 0;
        })
        .map((phase) => {
          const color = PHASE_COLORS[phase.name] ?? 'var(--interactive-muted)';
          const completion = workflowStatus.phase_completion.find(
            (pc) => pc.phase_num === phase.phase,
          );
          const percent = completion?.percent_complete ?? 0;
          const status = getPhaseStatus(
            phase.phase,
            workflowStatus.current_phase,
            percent,
          );
          const isActivePhase = phase.phase === activeWorkflowPhaseNum;

          return (
            <div
              key={phase.phase}
              className={cn(
                'flex flex-1 items-center gap-1.5 px-3',
                status === 'future' && 'opacity-60',
              )}
              style={{ borderLeft: `2px solid ${color}` }}
            >
              {status === 'complete' && (
                <CircleCheck className="h-3 w-3 shrink-0 text-status-complete" />
              )}
              {status === 'active' && (
                <CircleDot className="h-3 w-3 shrink-0 animate-pulse text-status-active" />
              )}
              {status === 'future' && (
                <Circle className="h-3 w-3 shrink-0 text-interactive-muted" />
              )}
              <span
                className={cn(
                  'truncate text-[length:var(--text-sm)]',
                  status === 'future'
                    ? 'text-interactive-muted'
                    : 'text-interactive-default',
                )}
              >
                {phase.name}
              </span>
              {/* Show agent badge + workflow label for the active workflow in its phase */}
              {isActivePhase && activeAgent && activeWorkflowLabel && (
                <div className="ml-1 flex items-center gap-1">
                  <AgentBadge agent={activeAgent} compact />
                  <span className="truncate text-[length:var(--text-xs)] text-interactive-active">
                    {activeWorkflowLabel}
                  </span>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
