import type { PhasesResponse, PhaseGraphNode, PhaseGraphEdge, NodeVisualState } from '../types/phases';
import type { WorkflowStatus, WorkflowStatusValue } from '../types/workflow';

// --- Pure utility functions (relocated from phases.store.ts) ---

const UPPERCASE_TOKENS = new Set(['prd', 'ux', 'ci', 'nfr', 'atdd']);
const STRIP_PREFIXES = ['create-', 'dev-'];
const SPECIAL_LABELS: Record<string, string> = {
  'check-implementation-readiness': 'Readiness Check',
};

export function formatWorkflowLabel(id: string): string {
  if (SPECIAL_LABELS[id]) return SPECIAL_LABELS[id];
  let label = id;
  for (const prefix of STRIP_PREFIXES) {
    if (label.startsWith(prefix)) {
      label = label.slice(prefix.length);
      break;
    }
  }
  return label
    .split('-')
    .map(word =>
      UPPERCASE_TOKENS.has(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

const STATUS_TO_VISUAL_STATE: Partial<Record<WorkflowStatusValue, NodeVisualState>> = {
  complete: 'complete',
  skipped: 'skipped',
  conditional: 'conditional',
  required: 'required',
  recommended: 'recommended',
  optional: 'optional',
};

export function getNodeVisualState(
  status: WorkflowStatusValue,
  isCurrent: boolean,
  dependenciesMet: boolean = true,
): NodeVisualState {
  if (isCurrent) return 'current';
  // Complete and skipped states take priority over dependency checks
  if (status === 'complete' || status === 'skipped') {
    return STATUS_TO_VISUAL_STATE[status]!;
  }
  if (!dependenciesMet) return 'locked';
  return STATUS_TO_VISUAL_STATE[status] ?? 'not-started';
}

/**
 * Compute phase graph nodes by reading from both phases and workflow data.
 * Use this in components or custom hooks.
 */
export function computePhaseGraphNodes(
  phases: PhasesResponse | null,
  ws: WorkflowStatus | null,
): PhaseGraphNode[] {
  if (!phases || !ws) return [];

  const sortedPhases = [...phases.phases].sort((a, b) => a.phase - b.phase);

  const statusOf = (wfId: string): WorkflowStatusValue =>
    (ws.workflow_statuses[wfId]?.status ?? 'not_started') as WorkflowStatusValue;

  const isComplete = (wfId: string): boolean => {
    const s = statusOf(wfId);
    return s === 'complete' || s === 'skipped';
  };

  let prevPhaseLastRequiredId: string | null = null;
  const nodes: PhaseGraphNode[] = [];

  for (const phase of sortedPhases) {
    const requiredInPhase = phase.workflows.filter(wf => wf.required);

    for (const wf of phase.workflows) {
      const unmetDeps: string[] = [];

      if (wf.required) {
        const myIndex = requiredInPhase.indexOf(wf);
        for (let i = 0; i < myIndex; i++) {
          if (!isComplete(requiredInPhase[i].id)) {
            unmetDeps.push(requiredInPhase[i].id);
          }
        }
        if (myIndex === 0 && prevPhaseLastRequiredId && !isComplete(prevPhaseLastRequiredId)) {
          unmetDeps.push(prevPhaseLastRequiredId);
        }
      }

      if (wf.included_by && !isComplete(wf.included_by)) {
        unmetDeps.push(wf.included_by);
      }

      nodes.push({
        workflow_id: wf.id,
        label: formatWorkflowLabel(wf.id),
        phase_num: phase.phase,
        is_required: wf.required,
        is_optional: wf.optional,
        is_conditional: wf.conditional !== null,
        agent: wf.agent ?? undefined,
        included_by: wf.included_by ?? undefined,
        purpose: wf.purpose ?? undefined,
        status: statusOf(wf.id),
        is_current: ws.next_workflow_id === wf.id,
        dependencies_met: unmetDeps.length === 0,
        unmet_dependencies: unmetDeps,
      });
    }

    if (requiredInPhase.length > 0) {
      prevPhaseLastRequiredId = requiredInPhase[requiredInPhase.length - 1].id;
    }
  }

  return nodes;
}

// --- Agent name to role mapping ---

const AGENT_DESCRIPTIONS: Record<string, string> = {
  mary: 'Product Manager',
  john: 'Architect',
  winston: 'UX Designer',
  sally: 'Scrum Master',
  bob: 'Developer',
  amelia: 'QA Engineer',
  barry: 'DevOps Engineer',
};

/**
 * Map an agent name (e.g. "Mary") to a brief role description.
 */
export function getAgentDescription(agentName: string): string {
  return AGENT_DESCRIPTIONS[agentName.toLowerCase()] ?? 'Agent';
}

/**
 * Return the output artifact path for a given workflow.
 */
export function getWorkflowOutput(
  workflowId: string,
  phases: PhasesResponse,
): string | null {
  for (const phase of phases.phases) {
    for (const wf of phase.workflows) {
      if (wf.id === workflowId) {
        return wf.output;
      }
    }
  }
  return null;
}

export interface WorkflowContextDependency {
  workflowId: string;
  outputPath: string;
  label: string;
}

/**
 * For a given workflow, walk the dependency chain backward through the PhasesResponse
 * to find all upstream workflows that produce outputs consumed by this workflow.
 *
 * Logic: find all required workflows in earlier phases (and earlier in the same phase)
 * that produce an output artifact. These are the "context" files the agent will load.
 */
export function getWorkflowContextDependencies(
  workflowId: string,
  phases: PhasesResponse,
): WorkflowContextDependency[] {
  const deps: WorkflowContextDependency[] = [];

  // Find the target workflow and its phase
  let targetPhaseNum = -1;
  let targetIndexInPhase = -1;

  const sortedPhases = [...phases.phases].sort((a, b) => a.phase - b.phase);

  for (const phase of sortedPhases) {
    const idx = phase.workflows.findIndex((wf) => wf.id === workflowId);
    if (idx !== -1) {
      targetPhaseNum = phase.phase;
      targetIndexInPhase = idx;
      break;
    }
  }

  if (targetPhaseNum === -1) return deps;

  // Walk all phases up to and including the target phase
  for (const phase of sortedPhases) {
    if (phase.phase > targetPhaseNum) break;

    for (let i = 0; i < phase.workflows.length; i++) {
      const wf = phase.workflows[i];

      // Skip the workflow itself
      if (wf.id === workflowId) continue;

      // In the same phase, only include workflows before the target
      if (phase.phase === targetPhaseNum && i >= targetIndexInPhase) continue;

      // Only include workflows that produce an output
      if (!wf.output) continue;

      // Only include required workflows (not optional/conditional)
      if (!wf.required) continue;

      deps.push({
        workflowId: wf.id,
        outputPath: wf.output,
        label: formatWorkflowLabel(wf.id),
      });
    }
  }

  return deps;
}

export function computePhaseGraphEdges(phases: PhasesResponse | null): PhaseGraphEdge[] {
  if (!phases) return [];

  const edges: PhaseGraphEdge[] = [];

  for (const phase of phases.phases) {
    const required = phase.workflows.filter(wf => wf.required);
    for (let i = 0; i < required.length - 1; i++) {
      edges.push({ from: required[i].id, to: required[i + 1].id, is_optional: false });
    }
    for (const wf of phase.workflows) {
      if (wf.included_by) {
        edges.push({
          from: wf.included_by,
          to: wf.id,
          is_optional: wf.optional || wf.conditional !== null,
        });
      }
    }
  }

  const sortedPhases = [...phases.phases].sort((a, b) => a.phase - b.phase);
  let lastCrossPhaseRequiredId: string | null = null;
  for (const phase of sortedPhases) {
    const phaseRequired = phase.workflows.filter(wf => wf.required);
    if (phaseRequired.length > 0) {
      if (lastCrossPhaseRequiredId) {
        edges.push({ from: lastCrossPhaseRequiredId, to: phaseRequired[0].id, is_optional: false });
      }
      lastCrossPhaseRequiredId = phaseRequired[phaseRequired.length - 1].id;
    }
  }

  return edges;
}
