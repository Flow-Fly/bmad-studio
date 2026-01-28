package types

// WorkflowStatus represents the parsed bmm-workflow-status.yaml file
// Used for reading track selection (kept for backward compatibility)
type WorkflowStatus struct {
	Track string `json:"track" yaml:"track"`
}

// Status value constants for workflow status
const (
	StatusRequired    = "required"
	StatusOptional    = "optional"
	StatusSkipped     = "skipped"
	StatusRecommended = "recommended"
	StatusConditional = "conditional"
	StatusNotStarted  = "not_started"
	StatusComplete    = "complete"
)

// Story status constants for sprint-status.yaml
const (
	StoryBacklog      = "backlog"
	StoryReadyForDev  = "ready-for-dev"
	StoryInProgress   = "in-progress"
	StoryReview       = "review"
	StoryDone         = "done"
)

// WorkflowStatusFile represents the full bmm-workflow-status.yaml file
type WorkflowStatusFile struct {
	Generated      string            `json:"generated" yaml:"generated"`
	Project        string            `json:"project" yaml:"project"`
	ProjectType    string            `json:"project_type" yaml:"project_type"`
	SelectedTrack  string            `json:"selected_track" yaml:"selected_track"`
	FieldType      string            `json:"field_type" yaml:"field_type"`
	WorkflowPath   string            `json:"workflow_path" yaml:"workflow_path"`
	WorkflowStatus map[string]string `json:"workflow_status" yaml:"workflow_status"`
}

// SprintStatusFile represents the sprint-status.yaml file
type SprintStatusFile struct {
	Generated         string            `json:"generated" yaml:"generated"`
	Project           string            `json:"project" yaml:"project"`
	ProjectKey        string            `json:"project_key" yaml:"project_key"`
	TrackingSystem    string            `json:"tracking_system" yaml:"tracking_system"`
	StoryLocation     string            `json:"story_location" yaml:"story_location"`
	DevelopmentStatus map[string]string `json:"development_status" yaml:"development_status"`
}

// WorkflowCompletion represents computed state for a single workflow
type WorkflowCompletion struct {
	WorkflowID   string  `json:"workflow_id"`
	Status       string  `json:"status"`
	ArtifactPath *string `json:"artifact_path"`
	IsComplete   bool    `json:"is_complete"`
	IsRequired   bool    `json:"is_required"`
}

// PhaseCompletionStatus represents completion stats for a single phase
type PhaseCompletionStatus struct {
	PhaseNum        int    `json:"phase_num"`
	Name            string `json:"name"`
	CompletedCount  int    `json:"completed_count"`
	TotalRequired   int    `json:"total_required"`
	PercentComplete int    `json:"percent_complete"`
}

// WorkflowCompletionStatus represents computed state for API response
type WorkflowCompletionStatus struct {
	WorkflowID   string  `json:"workflow_id"`
	Status       string  `json:"status"`
	ArtifactPath *string `json:"artifact_path"`
	IsComplete   bool    `json:"is_complete"`
	IsRequired   bool    `json:"is_required"`
	IsOptional   bool    `json:"is_optional"`
}

// StatusResponse is the API response for GET /api/v1/bmad/status
type StatusResponse struct {
	CurrentPhase      int                              `json:"current_phase"`
	CurrentPhaseName  string                           `json:"current_phase_name"`
	NextWorkflowID    *string                          `json:"next_workflow_id"`
	NextWorkflowAgent *string                          `json:"next_workflow_agent"`
	PhaseCompletion   []PhaseCompletionStatus          `json:"phase_completion"`
	WorkflowStatuses  map[string]WorkflowCompletionStatus `json:"workflow_statuses"`
	StoryStatuses     map[string]string                `json:"story_statuses,omitempty"`
}
