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

// validAgentContent returns a valid agent markdown file content for testing
func validAgentContent() string {
	return `---
name: "pm"
description: "Product Manager"
---

You must fully embody this agent's persona.

` + "```xml\n" + `<agent id="pm.agent.yaml" name="John" title="Product Manager" icon="📋">
<activation critical="MANDATORY">
  <step n="1">Load persona</step>
</activation>
<persona>
    <role>Product Manager specializing in collaborative PRD creation.</role>
    <identity>Product management veteran with 8+ years.</identity>
    <communication_style>Asks 'WHY?' relentlessly.</communication_style>
</persona>
<menu>
    <item cmd="MH or fuzzy match on menu or help">[MH] Redisplay Menu Help</item>
    <item cmd="CP or fuzzy match on create-prd" exec="{project-root}/_bmad/workflows/prd.md">[CP] Create PRD</item>
</menu>
</agent>
` + "```\n"
}

func setupTestServices(t *testing.T) (*services.BMadConfigService, *services.WorkflowPathService, *services.AgentService, string) {
	t.Helper()

	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")

	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create config file
	configContent := `project_name: test
planning_artifacts: "{project-root}/_bmad-output/planning"
implementation_artifacts: "{project-root}/_bmad-output/implementation"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create agent file
	if err := os.WriteFile(filepath.Join(agentsDir, "pm.md"), []byte(validAgentContent()), 0644); err != nil {
		t.Fatal(err)
	}

	configService := services.NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := services.NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		t.Fatalf("Failed to load agents: %v", err)
	}

	return configService, nil, agentService, tmpDir
}

func TestGetAgents_Returns200WithValidAgentList(t *testing.T) {
	configService, workflowPathService, agentService, _ := setupTestServices(t)

	router := api.NewRouterWithServices(configService, workflowPathService, agentService, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/agents", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rec.Code)
	}

	var result types.AgentsResponse
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(result.Agents) != 1 {
		t.Errorf("Expected 1 agent, got %d", len(result.Agents))
	}

	agent := result.Agents[0]
	if agent.ID != "pm.agent.yaml" {
		t.Errorf("Expected id 'pm.agent.yaml', got '%s'", agent.ID)
	}
	if agent.Name != "John" {
		t.Errorf("Expected name 'John', got '%s'", agent.Name)
	}
	if agent.Title != "Product Manager" {
		t.Errorf("Expected title 'Product Manager', got '%s'", agent.Title)
	}
}

func TestGetAgents_ReturnsErrorWhenServiceNotLoaded(t *testing.T) {
	configService := services.NewBMadConfigService()
	// Don't load config - service is not available

	router := api.NewRouterWithServices(configService, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/agents", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", rec.Code)
	}

	var errResp response.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	if errResp.Error.Code != "agents_not_loaded" {
		t.Errorf("Expected error code 'agents_not_loaded', got '%s'", errResp.Error.Code)
	}
}

func TestGetAgent_Returns200WithValidAgent(t *testing.T) {
	configService, workflowPathService, agentService, _ := setupTestServices(t)

	router := api.NewRouterWithServices(configService, workflowPathService, agentService, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/agents/pm.agent.yaml", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var agent types.AgentResponse
	if err := json.NewDecoder(rec.Body).Decode(&agent); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if agent.ID != "pm.agent.yaml" {
		t.Errorf("Expected id 'pm.agent.yaml', got '%s'", agent.ID)
	}
}

func TestGetAgent_Returns404WhenNotFound(t *testing.T) {
	configService, workflowPathService, agentService, _ := setupTestServices(t)

	router := api.NewRouterWithServices(configService, workflowPathService, agentService, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/bmad/agents/nonexistent.agent.yaml", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var errResp response.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	if errResp.Error.Code != "agent_not_found" {
		t.Errorf("Expected error code 'agent_not_found', got '%s'", errResp.Error.Code)
	}
}
