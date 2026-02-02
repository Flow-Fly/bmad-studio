import { Signal } from 'signal-polyfill';
import type { LoadingState } from '../types/project.js';
import type {
  PhasesResponse,
  PhaseGraphNode,
  PhaseGraphEdge,
  NodeVisualState,
} from '../types/phases.js';
import type { WorkflowStatusValue } from '../types/workflow.js';
import { workflowState } from './workflow.state.js';

export const phasesState = new Signal.State<PhasesResponse | null>(null);
export const phasesLoadingState = new Signal.State<LoadingState>({ status: 'idle' });

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
    .map(word => UPPERCASE_TOKENS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getNodeVisualState(
  status: WorkflowStatusValue,
  isCurrent: boolean,
  dependenciesMet: boolean = true,
): NodeVisualState {
  if (isCurrent) return 'current';
  if (status === 'complete') return 'complete';
  if (status === 'skipped') return 'skipped';
  if (!dependenciesMet) return 'locked';
  if (status === 'conditional') return 'conditional';
  if (status === 'required') return 'required';
  if (status === 'recommended') return 'recommended';
  if (status === 'optional') return 'optional';
  return 'not-started';
}

export const phaseGraphNodes$ = new Signal.Computed<PhaseGraphNode[]>(() => {
  const phases = phasesState.get();
  const ws = workflowState.get();
  if (!phases || !ws) return [];

  const sortedPhases = [...phases.phases].sort((a, b) => a.phase - b.phase);

  // Build a status lookup for dependency checking
  const statusOf = (wfId: string): WorkflowStatusValue =>
    (ws.workflow_statuses[wfId]?.status ?? 'not_started') as WorkflowStatusValue;

  const isComplete = (wfId: string): boolean => {
    const s = statusOf(wfId);
    return s === 'complete' || s === 'skipped';
  };

  // Track last required workflow of previous phase for cross-phase deps
  let prevPhaseLastRequiredId: string | null = null;

  const nodes: PhaseGraphNode[] = [];

  for (const phase of sortedPhases) {
    const requiredInPhase = phase.workflows.filter(wf => wf.required);

    for (const wf of phase.workflows) {
      // Compute dependencies_met:
      // 1. All preceding required workflows in the same phase must be complete/skipped
      // 2. If first required in this phase (phase > 1), last required of prev phase must be complete/skipped
      const unmetDeps: string[] = [];

      if (wf.required) {
        const myIndex = requiredInPhase.indexOf(wf);

        // Check preceding required workflows in same phase
        for (let i = 0; i < myIndex; i++) {
          if (!isComplete(requiredInPhase[i].id)) {
            unmetDeps.push(requiredInPhase[i].id);
          }
        }

        // Check cross-phase dependency (first required in phase needs last required of prev phase)
        if (myIndex === 0 && prevPhaseLastRequiredId && !isComplete(prevPhaseLastRequiredId)) {
          unmetDeps.push(prevPhaseLastRequiredId);
        }
      }

      // For non-required workflows with included_by, check if the parent is complete
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

    // Track last required of this phase for next phase's cross-phase dep
    if (requiredInPhase.length > 0) {
      prevPhaseLastRequiredId = requiredInPhase[requiredInPhase.length - 1].id;
    }
  }

  return nodes;
});

export const phaseGraphEdges$ = new Signal.Computed<PhaseGraphEdge[]>(() => {
  const phases = phasesState.get();
  if (!phases) return [];

  const edges: PhaseGraphEdge[] = [];

  for (const phase of phases.phases) {
    const required = phase.workflows.filter(wf => wf.required);

    // Within-phase sequential edges for required workflows
    for (let i = 0; i < required.length - 1; i++) {
      edges.push({
        from: required[i].id,
        to: required[i + 1].id,
        is_optional: false,
      });
    }

    // included_by edges
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

  // Cross-phase sequential edges: last required in phase N -> first required in phase N+1
  const sortedPhases = [...phases.phases].sort((a, b) => a.phase - b.phase);
  for (let i = 0; i < sortedPhases.length - 1; i++) {
    const currentRequired = sortedPhases[i].workflows.filter(wf => wf.required);
    const nextRequired = sortedPhases[i + 1].workflows.filter(wf => wf.required);
    if (currentRequired.length > 0 && nextRequired.length > 0) {
      edges.push({
        from: currentRequired[currentRequired.length - 1].id,
        to: nextRequired[0].id,
        is_optional: false,
      });
    }
  }

  return edges;
});

export function updatePhasesState(phases: PhasesResponse): void {
  phasesState.set(phases);
  phasesLoadingState.set({ status: 'success' });
}

export function clearPhasesState(): void {
  phasesState.set(null);
  phasesLoadingState.set({ status: 'idle' });
}
