package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"bmad-studio/backend/api"
	"bmad-studio/backend/api/response"
	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/services"
)

func newRouterWithProjectManager(t *testing.T) (http.Handler, string) {
	t.Helper()

	hub := websocket.NewHub()
	go hub.Run()
	t.Cleanup(func() { hub.Stop() })

	pm := services.NewProjectManager(hub)

	router := api.NewRouterWithServices(api.RouterServices{
		Hub:            hub,
		ProjectManager: pm,
	})

	return router, ""
}

func createBmadProject(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	// Create _bmad/bmm/config.yaml
	bmadDir := filepath.Join(dir, "_bmad", "bmm")
	if err := os.MkdirAll(bmadDir, 0755); err != nil {
		t.Fatal(err)
	}

	configContent := `project_name: test-project
user_skill_level: intermediate
planning_artifacts: "_bmad-output/planning-artifacts"
implementation_artifacts: "_bmad-output/implementation-artifacts"
user_name: Tester
communication_language: English
document_output_language: English
output_folder: "_bmad-output"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	return dir
}

func TestIntegration_OpenProject_ValidPath(t *testing.T) {
	router, _ := newRouterWithProjectManager(t)
	projectDir := createBmadProject(t)

	body := `{"path":"` + projectDir + `"}`
	req, _ := http.NewRequest("POST", "/api/v1/projects/open", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var info services.ProjectInfo
	if err := json.NewDecoder(rr.Body).Decode(&info); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if info.ProjectName == "" {
		t.Error("expected non-empty project name")
	}
	if info.ProjectRoot != projectDir {
		t.Errorf("expected project root %q, got %q", projectDir, info.ProjectRoot)
	}
	if !info.BmadLoaded {
		t.Error("expected bmad_loaded to be true")
	}
	if !info.Services.Config {
		t.Error("expected config service to be available")
	}
}

func TestIntegration_OpenProject_MissingBmad(t *testing.T) {
	router, _ := newRouterWithProjectManager(t)
	dir := t.TempDir() // No _bmad/ directory

	body := `{"path":"` + dir + `"}`
	req, _ := http.NewRequest("POST", "/api/v1/projects/open", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var errResp response.ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if errResp.Error.Code != "bmad_not_found" {
		t.Errorf("expected error code 'bmad_not_found', got %q", errResp.Error.Code)
	}
}

func TestIntegration_OpenProject_NonExistentPath(t *testing.T) {
	router, _ := newRouterWithProjectManager(t)

	body := `{"path":"/nonexistent/path/that/does/not/exist"}`
	req, _ := http.NewRequest("POST", "/api/v1/projects/open", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var errResp response.ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if errResp.Error.Code != "path_not_found" {
		t.Errorf("expected error code 'path_not_found', got %q", errResp.Error.Code)
	}
}

func TestIntegration_OpenProject_EmptyPath(t *testing.T) {
	router, _ := newRouterWithProjectManager(t)

	body := `{"path":""}`
	req, _ := http.NewRequest("POST", "/api/v1/projects/open", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d. Body: %s", rr.Code, rr.Body.String())
	}
}

func TestIntegration_OpenProject_InvalidJSON(t *testing.T) {
	router, _ := newRouterWithProjectManager(t)

	req, _ := http.NewRequest("POST", "/api/v1/projects/open", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d. Body: %s", rr.Code, rr.Body.String())
	}
}

func TestIntegration_OpenProject_MalformedConfig(t *testing.T) {
	router, _ := newRouterWithProjectManager(t)

	dir := t.TempDir()
	bmadDir := filepath.Join(dir, "_bmad", "bmm")
	if err := os.MkdirAll(bmadDir, 0755); err != nil {
		t.Fatal(err)
	}
	// Write malformed YAML (invalid indentation / format)
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(":\n  bad: [yaml: missing"), 0644); err != nil {
		t.Fatal(err)
	}

	body := `{"path":"` + dir + `"}`
	req, _ := http.NewRequest("POST", "/api/v1/projects/open", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var errResp response.ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if errResp.Error.Code != "bmad_config_invalid" {
		t.Errorf("expected error code 'bmad_config_invalid', got %q", errResp.Error.Code)
	}
}
