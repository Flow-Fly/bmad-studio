package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/services"
	"bmad-studio/backend/types"
)

func TestGetPhases_ReturnsValidPhaseStructure(t *testing.T) {
	tmpDir := t.TempDir()

	// Create config
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}
	configContent := `project_name: test
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create paths
	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	pathContent := `method_name: "Test Method"
track: "bmad-method"
field_type: "greenfield"
description: "Test description"

phases:
  - phase: 1
    name: "Planning"
    required: true
    workflows:
      - id: "test-workflow"
        exec: "{project-root}/test.md"
        required: true
        agent: "pm"
        command: "/test"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "bmad-method.yaml"), []byte(pathContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Setup services
	configSvc := services.NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := services.NewWorkflowPathService(configSvc)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	handler := NewBMadHandler(configSvc, pathSvc)

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/phases", nil)
	w := httptest.NewRecorder()

	handler.GetPhases(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var resp types.PhasesResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if resp.MethodName != "Test Method" {
		t.Errorf("Expected method_name 'Test Method', got '%s'", resp.MethodName)
	}
	if resp.Track != "bmad-method" {
		t.Errorf("Expected track 'bmad-method', got '%s'", resp.Track)
	}
	if len(resp.Phases) != 1 {
		t.Errorf("Expected 1 phase, got %d", len(resp.Phases))
	}
	if len(resp.Phases[0].Workflows) != 1 {
		t.Errorf("Expected 1 workflow, got %d", len(resp.Phases[0].Workflows))
	}
}

func TestGetPhases_ReturnsErrorWhenPathsNotLoaded(t *testing.T) {
	tmpDir := t.TempDir()

	// Create config only
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}
	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := services.NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := services.NewWorkflowPathService(configSvc)
	// Don't call LoadPaths - simulates service not loaded

	handler := NewBMadHandler(configSvc, pathSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/phases", nil)
	w := httptest.NewRecorder()

	handler.GetPhases(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", w.Code)
	}

	var errResp struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(w.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	if errResp.Error.Code != "path_files_not_found" {
		t.Errorf("Expected error code 'path_files_not_found', got '%s'", errResp.Error.Code)
	}
}

func TestGetPhases_ReturnsErrorWhenServiceNil(t *testing.T) {
	tmpDir := t.TempDir()

	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}
	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := services.NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	// Create handler with nil path service
	handler := NewBMadHandler(configSvc, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/phases", nil)
	w := httptest.NewRecorder()

	handler.GetPhases(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", w.Code)
	}
}
