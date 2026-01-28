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

func TestGetConfig_ReturnsConfig(t *testing.T) {
	// Set up a temp project with valid config
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}

	configContent := `project_name: test-project
user_skill_level: beginner
planning_artifacts: "{project-root}/planning"
implementation_artifacts: "{project-root}/impl"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/output"
user_name: TestUser
communication_language: English
document_output_language: English
tea_use_mcp_enhancements: true
tea_use_playwright_utils: false
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	svc := services.NewBMadConfigService()
	if err := svc.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	handler := NewBMadHandler(svc, nil, nil)

	req, err := http.NewRequest("GET", "/api/v1/bmad/config", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler.GetConfig(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}

	var config types.BMadConfig
	if err := json.NewDecoder(rr.Body).Decode(&config); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if config.ProjectName != "test-project" {
		t.Errorf("Expected project_name 'test-project', got '%s'", config.ProjectName)
	}
	if config.UserName != "TestUser" {
		t.Errorf("Expected user_name 'TestUser', got '%s'", config.UserName)
	}
}

func TestGetConfig_ReturnsErrorWhenNotLoaded(t *testing.T) {
	svc := services.NewBMadConfigService()
	// Don't load config - should return error
	handler := NewBMadHandler(svc, nil, nil)

	req, err := http.NewRequest("GET", "/api/v1/bmad/config", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler.GetConfig(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", rr.Code)
	}

	var errResp struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	if errResp.Error.Code != "bmad_not_installed" {
		t.Errorf("Expected error code 'bmad_not_installed', got '%s'", errResp.Error.Code)
	}
}
