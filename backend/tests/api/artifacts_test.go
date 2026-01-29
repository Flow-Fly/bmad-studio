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

func setupArtifactTestServices(t *testing.T) (*services.BMadConfigService, *services.ArtifactService, string) {
	t.Helper()

	tmpDir := t.TempDir()
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	outputDir := filepath.Join(tmpDir, "_bmad-output")
	planningDir := filepath.Join(outputDir, "planning-artifacts")

	for _, dir := range []string{bmadDir, outputDir, planningDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Create config file
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create test artifact
	prdContent := `---
status: complete
workflowType: prd
completedAt: "2026-01-27"
---
# Product Requirements Document

Test PRD content.
`
	if err := os.WriteFile(filepath.Join(planningDir, "prd.md"), []byte(prdContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create another artifact for testing
	archContent := `---
status: in-progress
workflowType: architecture
stepsCompleted: [1, 2, 3]
---
# Architecture Document

Test Architecture content.
`
	if err := os.WriteFile(filepath.Join(planningDir, "architecture.md"), []byte(archContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := services.NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	artifactService := services.NewArtifactService(configService, nil)
	if err := artifactService.LoadArtifacts(); err != nil {
		t.Fatalf("Failed to load artifacts: %v", err)
	}

	return configService, artifactService, tmpDir
}

func TestGetArtifacts_Returns200WithValidList(t *testing.T) {
	configService, artifactService, _ := setupArtifactTestServices(t)

	router := api.NewRouterWithServices(api.RouterServices{BMadConfig: configService, Artifact: artifactService})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/artifacts", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var result types.ArtifactsResponse
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(result.Artifacts) != 2 {
		t.Errorf("Expected 2 artifacts, got %d", len(result.Artifacts))
	}

	// Verify artifact fields
	var prdFound, archFound bool
	for _, artifact := range result.Artifacts {
		if artifact.Type == "prd" {
			prdFound = true
			if artifact.Status != "complete" {
				t.Errorf("PRD status = %s, want complete", artifact.Status)
			}
			if artifact.Phase != 2 {
				t.Errorf("PRD phase = %d, want 2", artifact.Phase)
			}
			if artifact.PhaseName != "Planning" {
				t.Errorf("PRD phase_name = %s, want Planning", artifact.PhaseName)
			}
		}
		if artifact.Type == "architecture" {
			archFound = true
			if artifact.Status != "in-progress" {
				t.Errorf("Architecture status = %s, want in-progress", artifact.Status)
			}
			if len(artifact.StepsCompleted) != 3 {
				t.Errorf("Architecture steps_completed len = %d, want 3", len(artifact.StepsCompleted))
			}
		}
	}

	if !prdFound {
		t.Error("PRD artifact not found")
	}
	if !archFound {
		t.Error("Architecture artifact not found")
	}
}

func TestGetArtifact_Returns200ForValidID(t *testing.T) {
	configService, artifactService, _ := setupArtifactTestServices(t)

	router := api.NewRouterWithServices(api.RouterServices{BMadConfig: configService, Artifact: artifactService})

	// Get list first to find valid ID
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/artifacts", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	var listResult types.ArtifactsResponse
	if err := json.NewDecoder(listRec.Body).Decode(&listResult); err != nil {
		t.Fatalf("Failed to decode list response: %v", err)
	}

	if len(listResult.Artifacts) == 0 {
		t.Fatal("No artifacts to test with")
	}

	// Get specific artifact
	artifactID := listResult.Artifacts[0].ID
	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/artifacts/"+artifactID, nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var artifact types.ArtifactResponse
	if err := json.NewDecoder(rec.Body).Decode(&artifact); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if artifact.ID != artifactID {
		t.Errorf("Artifact ID = %s, want %s", artifact.ID, artifactID)
	}
}

func TestGetArtifact_Returns404ForInvalidID(t *testing.T) {
	configService, artifactService, _ := setupArtifactTestServices(t)

	router := api.NewRouterWithServices(api.RouterServices{BMadConfig: configService, Artifact: artifactService})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/artifacts/nonexistent-artifact-id", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var errResp response.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	if errResp.Error.Code != "artifact_not_found" {
		t.Errorf("Expected error code 'artifact_not_found', got '%s'", errResp.Error.Code)
	}
}

func TestGetArtifacts_ReturnsEmptyArrayWhenNoArtifacts(t *testing.T) {
	tmpDir := t.TempDir()
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	for _, dir := range []string{bmadDir, outputDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Create config file
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := services.NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	artifactService := services.NewArtifactService(configService, nil)
	if err := artifactService.LoadArtifacts(); err != nil {
		t.Fatalf("Failed to load artifacts: %v", err)
	}

	router := api.NewRouterWithServices(api.RouterServices{BMadConfig: configService, Artifact: artifactService})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/artifacts", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var result types.ArtifactsResponse
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if result.Artifacts == nil {
		t.Error("Expected artifacts array to be non-nil (empty array, not null)")
	}

	if len(result.Artifacts) != 0 {
		t.Errorf("Expected 0 artifacts, got %d", len(result.Artifacts))
	}
}

func TestGetArtifacts_Returns404WhenServiceNotAvailable(t *testing.T) {
	configService := services.NewBMadConfigService()

	// Don't provide artifact service
	router := api.NewRouterWithServices(api.RouterServices{BMadConfig: configService})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/artifacts", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	// Route shouldn't exist if service is nil
	if rec.Code != http.StatusNotFound {
		t.Errorf("Expected status 404 when artifact service is nil, got %d", rec.Code)
	}
}
