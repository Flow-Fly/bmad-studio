package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/api"
	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"bmad-studio/backend/types"
)

func setupStatusTestServices(t *testing.T) (*services.BMadConfigService, *services.WorkflowPathService, *services.WorkflowStatusService, string) {
	t.Helper()

	tmpDir := t.TempDir()
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")

	for _, dir := range []string{bmadDir, pathsDir, planningDir, implDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Create config file
	configContent := `project_name: test
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create path definition file
	pathDefContent := `method_name: "BMAD Method"
track: "bmad-method"
field_type: "greenfield"
description: "Test track"
phases:
  - phase: 1
    name: "Analysis"
    required: false
    optional: true
    workflows:
      - id: "brainstorm-project"
        required: false
        optional: true
        agent: "analyst"
      - id: "product-brief"
        required: true
        optional: false
        agent: "analyst"
  - phase: 2
    name: "Planning"
    required: true
    optional: false
    workflows:
      - id: "prd"
        required: true
        optional: false
        agent: "pm"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create workflow status file
	workflowStatusContent := `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: "_bmad-output/brainstorm.md"
  product-brief: "_bmad-output/product-brief.md"
  prd: required
`
	if err := os.WriteFile(filepath.Join(planningDir, "bmm-workflow-status.yaml"), []byte(workflowStatusContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create sprint status file
	sprintStatusContent := `generated: 2026-01-27
project: test-project
project_key: test-project
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  epic-0: in-progress
  0-1-story-one: done
  0-2-story-two: in-progress
`
	if err := os.WriteFile(filepath.Join(implDir, "sprint-status.yaml"), []byte(sprintStatusContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := services.NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	pathService := services.NewWorkflowPathService(configService)
	if err := pathService.LoadPaths(); err != nil {
		t.Fatalf("Failed to load paths: %v", err)
	}

	statusService := services.NewWorkflowStatusService(configService, pathService)
	if err := statusService.LoadStatus(); err != nil {
		t.Fatalf("Failed to load status: %v", err)
	}

	return configService, pathService, statusService, tmpDir
}

func TestGetStatus_Returns200WithValidStatus(t *testing.T) {
	configService, pathService, statusService, _ := setupStatusTestServices(t)

	router := api.NewRouterWithServices(configService, pathService, nil, statusService, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/status", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var result types.StatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Verify current phase
	if result.CurrentPhase != 2 {
		t.Errorf("Expected current_phase 2, got %d", result.CurrentPhase)
	}

	if result.CurrentPhaseName != "Planning" {
		t.Errorf("Expected current_phase_name 'Planning', got '%s'", result.CurrentPhaseName)
	}

	// Verify next workflow
	if result.NextWorkflowID == nil || *result.NextWorkflowID != "prd" {
		t.Errorf("Expected next_workflow_id 'prd', got %v", result.NextWorkflowID)
	}

	if result.NextWorkflowAgent == nil || *result.NextWorkflowAgent != "pm" {
		t.Errorf("Expected next_workflow_agent 'pm', got %v", result.NextWorkflowAgent)
	}

	// Verify phase completion
	if len(result.PhaseCompletion) != 2 {
		t.Errorf("Expected 2 phases in completion, got %d", len(result.PhaseCompletion))
	}

	// Verify workflow statuses
	if len(result.WorkflowStatuses) != 3 {
		t.Errorf("Expected 3 workflow statuses, got %d", len(result.WorkflowStatuses))
	}

	// Check specific workflow status
	prdStatus, ok := result.WorkflowStatuses["prd"]
	if !ok {
		t.Error("Expected 'prd' in workflow_statuses")
	} else {
		if prdStatus.IsComplete {
			t.Error("Expected prd IsComplete to be false")
		}
		if !prdStatus.IsRequired {
			t.Error("Expected prd IsRequired to be true")
		}
	}

	// Verify story statuses
	if len(result.StoryStatuses) != 3 {
		t.Errorf("Expected 3 story statuses, got %d", len(result.StoryStatuses))
	}

	if result.StoryStatuses["0-1-story-one"] != "done" {
		t.Errorf("Expected story 0-1-story-one status 'done', got '%s'", result.StoryStatuses["0-1-story-one"])
	}
}

func TestGetStatus_ReturnsDefaultStateWhenNoStatusFiles(t *testing.T) {
	tmpDir := t.TempDir()
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")

	for _, dir := range []string{bmadDir, pathsDir, planningDir, implDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Create config file
	configContent := `project_name: test
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create path definition file
	pathDefContent := `method_name: "BMAD Method"
track: "bmad-method"
field_type: "greenfield"
description: "Test track"
phases:
  - phase: 1
    name: "Analysis"
    required: true
    optional: false
    workflows:
      - id: "brainstorm-project"
        required: true
        optional: false
        agent: "analyst"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatal(err)
	}

	// DON'T create status files - test default state

	configService := services.NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	pathService := services.NewWorkflowPathService(configService)
	if err := pathService.LoadPaths(); err != nil {
		t.Fatalf("Failed to load paths: %v", err)
	}

	statusService := services.NewWorkflowStatusService(configService, pathService)
	if err := statusService.LoadStatus(); err != nil {
		t.Fatalf("LoadStatus() error = %v, expected nil for missing files", err)
	}

	router := api.NewRouterWithServices(configService, pathService, nil, statusService, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/status", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var result types.StatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Should return default state
	if result.CurrentPhase != 1 {
		t.Errorf("Expected current_phase 1 (default), got %d", result.CurrentPhase)
	}

	if result.CurrentPhaseName != "Analysis" {
		t.Errorf("Expected current_phase_name 'Analysis', got '%s'", result.CurrentPhaseName)
	}

	// All workflows should be not_started
	for wfID, wfStatus := range result.WorkflowStatuses {
		if wfStatus.Status != types.StatusNotStarted {
			t.Errorf("Workflow %s status = %s, want not_started", wfID, wfStatus.Status)
		}
	}

	// Story statuses should be nil/empty when no sprint-status.yaml
	if len(result.StoryStatuses) != 0 {
		t.Errorf("Expected empty story_statuses when no sprint-status.yaml, got %d", len(result.StoryStatuses))
	}
}

func TestGetStatus_ReturnsErrorWhenServiceNotLoaded(t *testing.T) {
	configService := services.NewBMadConfigService()

	router := api.NewRouterWithServices(configService, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/status", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", rec.Code)
	}

	var errResp response.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	if errResp.Error.Code != "status_not_loaded" {
		t.Errorf("Expected error code 'status_not_loaded', got '%s'", errResp.Error.Code)
	}
}
