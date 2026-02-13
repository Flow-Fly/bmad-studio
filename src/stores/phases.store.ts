import { create } from 'zustand';
import type { LoadingState } from '../types/project';
import type { PhasesResponse, PhaseGraphNode, PhaseGraphEdge, NodeVisualState } from '../types/phases';
import type { WorkflowStatusValue } from '../types/workflow';

interface PhasesState {
  phases: PhasesResponse | null;
  loadingState: LoadingState;

  // Actions
  updatePhases: (phases: PhasesResponse) => void;
  setLoadingState: (state: LoadingState) => void;
  clearPhasesState: () => void;
}

export const usePhasesStore = create<PhasesState>((set) => ({
  phases: null,
  loadingState: { status: 'idle' },

  updatePhases: (phases) =>
    set({ phases, loadingState: { status: 'success' } }),

  setLoadingState: (loadingState) => set({ loadingState }),

  clearPhasesState: () =>
    set({ phases: null, loadingState: { status: 'idle' } }),
}));

// --- Pure utility functions (no store dependency) ---

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
 * Compute phase graph nodes by reading from both phases and workflow stores.
 * Use this in components or custom hooks.
 */
export function computePhaseGraphNodes(
  phases: PhasesResponse | null,
  ws: import('../types/workflow').WorkflowStatus | null,
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
