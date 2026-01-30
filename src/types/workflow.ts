export interface PhaseCompletionStatus {
  phase_num: number;
  name: string;
  completed_count: number;
  total_required: number;
  percent_complete: number;
}

export type WorkflowStatusValue =
  | 'complete'
  | 'not_started'
  | 'required'
  | 'optional'
  | 'skipped'
  | 'recommended';

export interface WorkflowCompletionStatus {
  workflow_id: string;
  status: WorkflowStatusValue;
  artifact_path?: string | null;
  is_complete: boolean;
  is_required: boolean;
  is_optional: boolean;
}

export interface StoryStatus {
  [key: string]: string;
}

export interface WorkflowStatus {
  current_phase: number;
  current_phase_name: string;
  next_workflow_id?: string | null;
  next_workflow_agent?: string | null;
  phase_completion: PhaseCompletionStatus[];
  workflow_statuses: Record<string, WorkflowCompletionStatus>;
  story_statuses?: StoryStatus;
}
