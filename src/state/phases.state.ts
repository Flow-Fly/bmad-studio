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

export function getNodeVisualState(
  status: WorkflowStatusValue,
  isCurrent: boolean,
): NodeVisualState {
  if (isCurrent) return 'current';
  if (status === 'complete') return 'complete';
  if (status === 'skipped') return 'skipped';
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

  return phases.phases.flatMap(phase =>
    phase.workflows.map(wf => ({
      workflow_id: wf.id,
      label: wf.id,
      phase_num: phase.phase,
      is_required: wf.required,
      is_optional: wf.optional,
      is_conditional: wf.conditional !== null,
      agent: wf.agent ?? undefined,
      included_by: wf.included_by ?? undefined,
      status: (ws.workflow_statuses[wf.id]?.status ?? 'not_started') as WorkflowStatusValue,
      is_current: ws.next_workflow_id === wf.id,
    })),
  );
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
