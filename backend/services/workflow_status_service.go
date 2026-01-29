package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"bmad-studio/backend/types"

	"gopkg.in/yaml.v3"
)

// WorkflowStatusError represents a structured error from the workflow status service
type WorkflowStatusError struct {
	Code    string
	Message string
}

func (e *WorkflowStatusError) Error() string {
	return e.Message
}

const (
	ErrCodeStatusNotLoaded   = "status_not_loaded"
	ErrCodeInvalidStatusFile = "invalid_status_file"
	ErrCodePathsNotLoaded    = "paths_not_loaded"
)

// WorkflowStatusService manages loading and accessing BMAD workflow status
type WorkflowStatusService struct {
	mu             sync.RWMutex
	configService  *BMadConfigService
	pathService    *WorkflowPathService
	workflowStatus *types.WorkflowStatusFile // Parsed bmm-workflow-status.yaml
	sprintStatus   *types.SprintStatusFile   // Parsed sprint-status.yaml (may be nil)
}

// NewWorkflowStatusService creates a new WorkflowStatusService instance
func NewWorkflowStatusService(cs *BMadConfigService, ps *WorkflowPathService) *WorkflowStatusService {
	return &WorkflowStatusService{
		configService: cs,
		pathService:   ps,
	}
}

// LoadStatus reads and parses both status files
func (s *WorkflowStatusService) LoadStatus() error {
	config := s.configService.GetConfig()
	if config == nil {
		return &WorkflowStatusError{
			Code:    ErrCodeConfigNotLoaded,
			Message: "BMadConfigService has no config loaded (can't determine paths)",
		}
	}

	// Parse workflow status file
	workflowStatusPath := filepath.Join(config.PlanningArtifacts, "bmm-workflow-status.yaml")
	workflowStatus, err := s.parseWorkflowStatus(workflowStatusPath)
	if err != nil {
		// Only return error for parse failures, not for missing files
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}
		// File doesn't exist - will use default state
		workflowStatus = nil
	}

	// Parse sprint status file
	sprintStatusPath := filepath.Join(config.ImplementationArtifacts, "sprint-status.yaml")
	sprintStatus, err := s.parseSprintStatus(sprintStatusPath)
	if err != nil {
		// Only return error for parse failures, not for missing files
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}
		// File doesn't exist - will be nil
		sprintStatus = nil
	}

	s.mu.Lock()
	s.workflowStatus = workflowStatus
	s.sprintStatus = sprintStatus
	s.mu.Unlock()

	return nil
}

// parseWorkflowStatus reads and parses bmm-workflow-status.yaml
func (s *WorkflowStatusService) parseWorkflowStatus(path string) (*types.WorkflowStatusFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var status types.WorkflowStatusFile
	if err := yaml.Unmarshal(data, &status); err != nil {
		return nil, &WorkflowStatusError{
			Code:    ErrCodeInvalidStatusFile,
			Message: fmt.Sprintf("Failed to parse bmm-workflow-status.yaml: %v", err),
		}
	}

	return &status, nil
}

// parseSprintStatus reads and parses sprint-status.yaml
func (s *WorkflowStatusService) parseSprintStatus(path string) (*types.SprintStatusFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var status types.SprintStatusFile
	if err := yaml.Unmarshal(data, &status); err != nil {
		return nil, &WorkflowStatusError{
			Code:    ErrCodeInvalidStatusFile,
			Message: fmt.Sprintf("Failed to parse sprint-status.yaml: %v", err),
		}
	}

	return &status, nil
}

// looksLikeFilePath returns true if the value appears to be a file path
// (contains path separators or has a recognized file extension)
func looksLikeFilePath(value string) bool {
	return strings.ContainsAny(value, "/\\") ||
		strings.HasSuffix(value, ".md") ||
		strings.HasSuffix(value, ".yaml")
}

// isComplete determines if a workflow status value indicates completion
func (s *WorkflowStatusService) isComplete(statusValue string) bool {
	if statusValue == types.StatusSkipped {
		return true
	}

	switch statusValue {
	case types.StatusRequired, types.StatusOptional, types.StatusRecommended, types.StatusConditional, types.StatusNotStarted:
		return false
	}

	if looksLikeFilePath(statusValue) {
		return true
	}

	// Unknown status values are treated as incomplete
	return false
}

// isWorkflowRequired determines if a workflow is required (not optional and not conditional)
func (s *WorkflowStatusService) isWorkflowRequired(wf types.WorkflowResponse) bool {
	return wf.Required && !wf.Optional && wf.Conditional == nil
}

// computeCurrentPhase finds the first phase with an incomplete required workflow
func (s *WorkflowStatusService) computeCurrentPhase(phases []types.PhaseResponse, statuses map[string]string) (int, string) {
	for _, phase := range phases {
		for _, wf := range phase.Workflows {
			if s.isWorkflowRequired(wf) {
				status, exists := statuses[wf.ID]
				if !exists || !s.isComplete(status) {
					return phase.PhaseNum, phase.Name
				}
			}
		}
	}

	// All complete - return phase after last
	if len(phases) > 0 {
		return phases[len(phases)-1].PhaseNum + 1, ""
	}
	return 1, ""
}

// computeNextWorkflow finds the first incomplete required workflow and its agent
func (s *WorkflowStatusService) computeNextWorkflow(phases []types.PhaseResponse, statuses map[string]string) (*string, *string) {
	for _, phase := range phases {
		for _, wf := range phase.Workflows {
			if s.isWorkflowRequired(wf) {
				status, exists := statuses[wf.ID]
				if !exists || !s.isComplete(status) {
					wfID := wf.ID
					return &wfID, wf.Agent
				}
			}
		}
	}

	// All complete
	return nil, nil
}

// computePhaseCompletion calculates completion stats for each phase
func (s *WorkflowStatusService) computePhaseCompletion(phases []types.PhaseResponse, statuses map[string]string) []types.PhaseCompletionStatus {
	result := make([]types.PhaseCompletionStatus, 0, len(phases))

	for _, phase := range phases {
		totalRequired := 0
		completed := 0

		for _, wf := range phase.Workflows {
			if s.isWorkflowRequired(wf) {
				totalRequired++
				status, exists := statuses[wf.ID]
				if exists && s.isComplete(status) {
					completed++
				}
			}
		}

		percentComplete := 0
		if totalRequired > 0 {
			percentComplete = (completed * 100) / totalRequired
		} else {
			// Optional phase with no required workflows = 100%
			percentComplete = 100
		}

		result = append(result, types.PhaseCompletionStatus{
			PhaseNum:        phase.PhaseNum,
			Name:            phase.Name,
			CompletedCount:  completed,
			TotalRequired:   totalRequired,
			PercentComplete: percentComplete,
		})
	}

	return result
}

// computeWorkflowStatuses builds the workflow status map for the response
func (s *WorkflowStatusService) computeWorkflowStatuses(phases []types.PhaseResponse, statuses map[string]string) map[string]types.WorkflowCompletionStatus {
	result := make(map[string]types.WorkflowCompletionStatus)

	for _, phase := range phases {
		for _, wf := range phase.Workflows {
			statusValue, exists := statuses[wf.ID]

			var status string
			var artifactPath *string
			var isComplete bool

			if !exists {
				status = types.StatusNotStarted
				isComplete = false
			} else if s.isComplete(statusValue) {
				status = types.StatusComplete
				isComplete = true
				if looksLikeFilePath(statusValue) {
					artifactPath = &statusValue
				}
			} else {
				status = statusValue
				isComplete = false
			}

			result[wf.ID] = types.WorkflowCompletionStatus{
				WorkflowID:   wf.ID,
				Status:       status,
				ArtifactPath: artifactPath,
				IsComplete:   isComplete,
				IsRequired:   wf.Required && !wf.Optional,
				IsOptional:   wf.Optional,
			}
		}
	}

	return result
}

// Reload reloads the status files from disk
// Used by file watcher to refresh status after changes
func (s *WorkflowStatusService) Reload() error {
	return s.LoadStatus()
}

// GetStatus returns the computed status response
func (s *WorkflowStatusService) GetStatus() (*types.StatusResponse, error) {
	// Get phases from path service OUTSIDE the lock (I/O operation)
	phasesResp, err := s.pathService.GetPhases()
	if err != nil {
		return nil, &WorkflowStatusError{
			Code:    ErrCodePathsNotLoaded,
			Message: fmt.Sprintf("Failed to get phases: %v", err),
		}
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	// Get workflow statuses (empty map if file doesn't exist)
	workflowStatuses := make(map[string]string)
	if s.workflowStatus != nil && s.workflowStatus.WorkflowStatus != nil {
		workflowStatuses = s.workflowStatus.WorkflowStatus
	}

	// Compute current phase and next workflow
	currentPhase, currentPhaseName := s.computeCurrentPhase(phasesResp.Phases, workflowStatuses)
	nextWorkflowID, nextWorkflowAgent := s.computeNextWorkflow(phasesResp.Phases, workflowStatuses)

	// Build response
	response := &types.StatusResponse{
		CurrentPhase:      currentPhase,
		CurrentPhaseName:  currentPhaseName,
		NextWorkflowID:    nextWorkflowID,
		NextWorkflowAgent: nextWorkflowAgent,
		PhaseCompletion:   s.computePhaseCompletion(phasesResp.Phases, workflowStatuses),
		WorkflowStatuses:  s.computeWorkflowStatuses(phasesResp.Phases, workflowStatuses),
	}

	// Add story statuses if sprint status exists
	if s.sprintStatus != nil && s.sprintStatus.DevelopmentStatus != nil {
		response.StoryStatuses = s.sprintStatus.DevelopmentStatus
	}

	return response, nil
}
