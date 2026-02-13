import type { WorkflowStatusValue } from './workflow';

export interface WorkflowResponse {
  id: string;
  exec: string | null;
  required: boolean;
  optional: boolean;
  conditional: string | null;
  condition_type: string | null;
  agent: string | null;
  command: string | null;
  output: string | null;
  note: string | null;
  included_by: string | null;
  purpose: string | null;
}

export interface PhaseResponse {
  phase: number;
  name: string;
  required: boolean;
  optional: boolean;
  note: string | null;
  workflows: WorkflowResponse[];
}

export interface PhasesResponse {
  method_name: string;
  track: string;
  field_type: string;
  description: string;
  phases: PhaseResponse[];
}

export interface PhaseGraphNode {
  workflow_id: string;
  label: string;
  phase_num: number;
  is_required: boolean;
  is_optional: boolean;
  is_conditional: boolean;
  agent?: string;
  included_by?: string;
  purpose?: string;
  status: WorkflowStatusValue;
  is_current: boolean;
  dependencies_met: boolean;
  unmet_dependencies: string[];
}

export interface PhaseGraphEdge {
  from: string;
  to: string;
  is_optional: boolean;
}

export type NodeVisualState =
  | 'current'
  | 'complete'
  | 'skipped'
  | 'locked'
  | 'conditional'
  | 'required'
  | 'recommended'
  | 'optional'
  | 'not-started';
