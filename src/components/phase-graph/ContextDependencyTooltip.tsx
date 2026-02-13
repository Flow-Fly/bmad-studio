import { CircleCheck, CircleX, AlertTriangle } from 'lucide-react';
import type { PhaseGraphNode } from '../../types/phases';
import type { PhasesResponse } from '../../types/phases';
import type { WorkflowStatus } from '../../types/workflow';
import {
  getAgentDescription,
  getWorkflowContextDependencies,
  getWorkflowOutput,
  formatWorkflowLabel,
} from '../../lib/phase-utils';
import { cn } from '../../lib/utils';

interface ContextDependencyTooltipProps {
  node: PhaseGraphNode;
  phases: PhasesResponse;
  workflowStatus: WorkflowStatus;
}

export function ContextDependencyTooltip({
  node,
  phases,
  workflowStatus,
}: ContextDependencyTooltipProps) {
  const agentRole = node.agent ? getAgentDescription(node.agent) : null;
  const contextDeps = getWorkflowContextDependencies(node.workflow_id, phases);
  const output = getWorkflowOutput(node.workflow_id, phases);

  // Find the command for this workflow
  let command: string | null = null;
  for (const phase of phases.phases) {
    const wf = phase.workflows.find((w) => w.id === node.workflow_id);
    if (wf) {
      command = wf.command;
      break;
    }
  }

  // Check availability of each context dependency
  const depsWithAvailability = contextDeps.map((dep) => {
    const wfStatus = workflowStatus.workflow_statuses[dep.workflowId];
    const isAvailable = !!(wfStatus?.artifact_path);
    return { ...dep, isAvailable };
  });

  const hasMissingDeps = depsWithAvailability.some((d) => !d.isAvailable);

  // Locked node unmet dependencies
  const isLocked =
    !node.dependencies_met && node.unmet_dependencies.length > 0;

  return (
    <div
      className="flex max-w-[320px] flex-col gap-2 p-1"
      aria-label={`Workflow details for ${node.label}`}
    >
      {/* Workflow title */}
      <div className="text-[length:var(--text-sm)] font-semibold text-interactive-active">
        {node.label}
      </div>

      {/* Agent info */}
      {node.agent && (
        <div className="text-[length:var(--text-xs)] text-interactive-default">
          Agent: {node.agent}
          {agentRole && (
            <span className="text-interactive-muted"> ({agentRole})</span>
          )}
        </div>
      )}

      {/* BMAD skill command */}
      {command && (
        <div className="text-[length:var(--text-xs)] text-interactive-default">
          Skill:{' '}
          <code className="rounded-[var(--radius-sm)] bg-surface-overlay px-1 py-0.5 font-mono text-[length:var(--text-xs)] text-interactive-active">
            {command}
          </code>
        </div>
      )}

      {/* Context artifacts */}
      {depsWithAvailability.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[length:var(--text-xs)] font-medium text-interactive-default">
            Context:
          </span>
          {depsWithAvailability.map((dep) => (
            <div
              key={dep.workflowId}
              className="flex items-center gap-1.5 pl-1"
            >
              {dep.isAvailable ? (
                <CircleCheck className="h-3 w-3 shrink-0 text-status-complete" />
              ) : (
                <CircleX className="h-3 w-3 shrink-0 text-status-blocked" />
              )}
              <span
                className={cn(
                  'font-mono text-[length:var(--text-xs)]',
                  dep.isAvailable
                    ? 'text-interactive-default'
                    : 'text-status-blocked',
                )}
              >
                {dep.outputPath}
              </span>
              {!dep.isAvailable && (
                <span className="text-[length:var(--text-xs)] text-interactive-muted">
                  (not available)
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Produces */}
      {output && (
        <div className="text-[length:var(--text-xs)] text-interactive-default">
          Produces:{' '}
          <code className="rounded-[var(--radius-sm)] bg-surface-overlay px-1 py-0.5 font-mono text-[length:var(--text-xs)] text-interactive-active">
            {output}
          </code>
        </div>
      )}

      {/* Missing dependencies warning */}
      {hasMissingDeps && (
        <div className="flex items-center gap-1.5 border-t border-surface-border pt-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 text-status-blocked" />
          <span className="text-[length:var(--text-xs)] text-status-blocked">
            Some context files are not yet available
          </span>
        </div>
      )}

      {/* Locked: show unmet dependencies */}
      {isLocked && (
        <div className="border-t border-surface-border pt-1.5 text-[length:var(--text-xs)] text-interactive-muted">
          Blocked by:{' '}
          {node.unmet_dependencies.map((id) => formatWorkflowLabel(id)).join(', ')}
        </div>
      )}
    </div>
  );
}
