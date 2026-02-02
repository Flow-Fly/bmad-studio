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

// WorkflowPathError represents a structured error from the workflow path service
type WorkflowPathError struct {
	Code    string
	Message string
}

func (e *WorkflowPathError) Error() string {
	return e.Message
}

const (
	ErrCodePathFilesNotFound     = "path_files_not_found"
	ErrCodeInvalidPathDefinition = "invalid_path_definition"
	ErrCodeTrackNotFound         = "track_not_found"
	ErrCodeConfigNotLoaded       = "config_not_loaded"
)

// WorkflowPathService manages loading and accessing BMAD workflow path definitions
type WorkflowPathService struct {
	mu            sync.RWMutex
	configService *BMadConfigService
	pathDefs      map[string]*types.PathDefinition // Keyed by track name
	selectedTrack string
}

// NewWorkflowPathService creates a new WorkflowPathService instance
func NewWorkflowPathService(configService *BMadConfigService) *WorkflowPathService {
	return &WorkflowPathService{
		configService: configService,
		pathDefs:      make(map[string]*types.PathDefinition),
	}
}

// LoadPaths scans and parses all workflow path definition files
func (s *WorkflowPathService) LoadPaths() error {
	config := s.configService.GetConfig()
	if config == nil {
		return &WorkflowPathError{
			Code:    ErrCodeConfigNotLoaded,
			Message: "BMadConfigService has no config loaded (can't determine project root)",
		}
	}

	projectRoot := config.ProjectRoot
	pathsDir := filepath.Join(projectRoot, "_bmad", "bmm", "workflows", "workflow-status", "paths")

	// Check if directory exists
	if _, err := os.Stat(pathsDir); errors.Is(err, os.ErrNotExist) {
		return &WorkflowPathError{
			Code:    ErrCodePathFilesNotFound,
			Message: fmt.Sprintf("Path definitions directory not found: %s", pathsDir),
		}
	}

	// Find all YAML files
	pathFiles, err := filepath.Glob(filepath.Join(pathsDir, "*.yaml"))
	if err != nil {
		return &WorkflowPathError{
			Code:    ErrCodePathFilesNotFound,
			Message: fmt.Sprintf("Failed to scan path definitions directory: %v", err),
		}
	}

	if len(pathFiles) == 0 {
		return &WorkflowPathError{
			Code:    ErrCodePathFilesNotFound,
			Message: fmt.Sprintf("No YAML files found in path definitions directory: %s", pathsDir),
		}
	}

	// Parse all path definition files
	pathDefs := make(map[string]*types.PathDefinition)
	for _, pathFile := range pathFiles {
		data, err := os.ReadFile(pathFile)
		if err != nil {
			return &WorkflowPathError{
				Code:    ErrCodeInvalidPathDefinition,
				Message: fmt.Sprintf("Failed to read path definition file %s: %v", filepath.Base(pathFile), err),
			}
		}

		var pathDef types.PathDefinition
		if err := yaml.Unmarshal(data, &pathDef); err != nil {
			return &WorkflowPathError{
				Code:    ErrCodeInvalidPathDefinition,
				Message: fmt.Sprintf("Failed to parse path definition file %s: %v", filepath.Base(pathFile), err),
			}
		}

		// Resolve {project-root} placeholders in all workflow paths
		s.resolveWorkflowVariables(&pathDef, projectRoot)

		pathDefs[pathDef.Track] = &pathDef
	}

	// Determine selected track from workflow status file
	selectedTrack := s.loadSelectedTrack(config)

	s.mu.Lock()
	s.pathDefs = pathDefs
	s.selectedTrack = selectedTrack
	s.mu.Unlock()

	return nil
}

// loadSelectedTrack reads the track from bmm-workflow-status.yaml or returns default
func (s *WorkflowPathService) loadSelectedTrack(config *types.BMadConfig) string {
	statusPath := filepath.Join(config.PlanningArtifacts, "bmm-workflow-status.yaml")

	data, err := os.ReadFile(statusPath)
	if err != nil {
		// Default to bmad-method if status file doesn't exist
		return "bmad-method"
	}

	var status types.WorkflowStatus
	if err := yaml.Unmarshal(data, &status); err != nil {
		// Default to bmad-method if parse fails
		return "bmad-method"
	}

	if status.Track == "" {
		return "bmad-method"
	}

	return status.Track
}

// GetSelectedTrack returns the currently selected track name
func (s *WorkflowPathService) GetSelectedTrack() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.selectedTrack
}

// GetPhases returns the phases for the currently selected track
func (s *WorkflowPathService) GetPhases() (*types.PhasesResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.pathDefs) == 0 {
		return nil, &WorkflowPathError{
			Code:    ErrCodePathFilesNotFound,
			Message: "No path definitions loaded. Call LoadPaths() first.",
		}
	}

	pathDef, ok := s.pathDefs[s.selectedTrack]
	if !ok {
		return nil, &WorkflowPathError{
			Code:    ErrCodeTrackNotFound,
			Message: fmt.Sprintf("Selected track '%s' not found in loaded path definitions", s.selectedTrack),
		}
	}

	// Convert internal types to response types
	return s.toResponse(pathDef), nil
}

// GetCompletionArtifacts returns the completion artifact glob patterns for a workflow ID
// in the currently selected track. Returns nil if the workflow is not found or has no artifacts.
func (s *WorkflowPathService) GetCompletionArtifacts(workflowID string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	pathDef, ok := s.pathDefs[s.selectedTrack]
	if !ok {
		return nil
	}

	for _, phase := range pathDef.Phases {
		for _, wf := range phase.Workflows {
			if wf.ID == workflowID {
				return wf.CompletionArtifacts
			}
		}
	}
	return nil
}

// resolveWorkflowVariables replaces {project-root} in workflow exec and workflow paths
func (s *WorkflowPathService) resolveWorkflowVariables(pathDef *types.PathDefinition, projectRoot string) {
	for i := range pathDef.Phases {
		for j := range pathDef.Phases[i].Workflows {
			wf := &pathDef.Phases[i].Workflows[j]
			wf.Exec = strings.ReplaceAll(wf.Exec, "{project-root}", projectRoot)
			wf.WorkflowRef = strings.ReplaceAll(wf.WorkflowRef, "{project-root}", projectRoot)
		}
	}
}

// toResponse converts internal PathDefinition to API response format
func (s *WorkflowPathService) toResponse(pathDef *types.PathDefinition) *types.PhasesResponse {
	phases := make([]types.PhaseResponse, 0, len(pathDef.Phases))

	for _, phase := range pathDef.Phases {
		workflows := make([]types.WorkflowResponse, 0, len(phase.Workflows))

		for _, wf := range phase.Workflows {
			wfResp := types.WorkflowResponse{
				ID:       wf.ID,
				Required: wf.Required,
				Optional: wf.Optional,
			}

			// Set optional fields with nil for empty values
			if wf.Exec != "" {
				wfResp.Exec = &wf.Exec
			} else if wf.WorkflowRef != "" {
				wfResp.Exec = &wf.WorkflowRef
			}

			if wf.Conditional != "" {
				wfResp.Conditional = &wf.Conditional
				wfResp.ConditionType = &wf.Conditional
			}

			if wf.Agent != "" {
				wfResp.Agent = &wf.Agent
			}

			if wf.Command != "" {
				wfResp.Command = &wf.Command
			}

			if wf.Output != "" {
				wfResp.Output = &wf.Output
			}

			if wf.Note != "" {
				wfResp.Note = &wf.Note
			}

			if wf.IncludedBy != "" {
				wfResp.IncludedBy = &wf.IncludedBy
			}

			if wf.Purpose != "" {
				wfResp.Purpose = &wf.Purpose
			}

			workflows = append(workflows, wfResp)
		}

		phaseResp := types.PhaseResponse{
			PhaseNum:  phase.PhaseNum,
			Name:      phase.Name,
			Required:  phase.Required,
			Optional:  phase.Optional,
			Workflows: workflows,
		}

		if phase.Note != "" {
			phaseResp.Note = &phase.Note
		}

		phases = append(phases, phaseResp)
	}

	return &types.PhasesResponse{
		MethodName:  pathDef.MethodName,
		Track:       pathDef.Track,
		FieldType:   pathDef.FieldType,
		Description: pathDef.Description,
		Phases:      phases,
	}
}
