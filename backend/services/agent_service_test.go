package services

import (
	"os"
	"path/filepath"
	"testing"
)

// createTestAgentFile creates a test agent markdown file with YAML frontmatter and XML content
func createTestAgentFile(t *testing.T, dir string, filename string, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, filename), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

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
    <item cmd="WS or fuzzy match on workflow-status" workflow="{project-root}/_bmad/workflows/status.yaml">[WS] Get workflow status</item>
</menu>
</agent>
` + "```\n"
}

func TestAgentService_LoadAgents_ValidFile(t *testing.T) {
	// Setup: create temp directory structure
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create a valid agent file
	createTestAgentFile(t, agentsDir, "pm.md", validAgentContent())

	// Create config service and load config
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	configContent := `project_name: test
planning_artifacts: "{project-root}/_bmad-output/planning"
implementation_artifacts: "{project-root}/_bmad-output/implementation"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Test
	agentService := NewAgentService(configService)
	err := agentService.LoadAgents()
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	agents, err := agentService.GetAgents()
	if err != nil {
		t.Fatalf("Expected no error getting agents, got: %v", err)
	}

	if len(agents) != 1 {
		t.Fatalf("Expected 1 agent, got %d", len(agents))
	}

	agent := agents[0]

	// Verify frontmatter fields
	if agent.FrontmatterName != "pm" {
		t.Errorf("Expected frontmatter_name 'pm', got '%s'", agent.FrontmatterName)
	}
	if agent.Description != "Product Manager" {
		t.Errorf("Expected description 'Product Manager', got '%s'", agent.Description)
	}

	// Verify XML agent attributes
	if agent.ID != "pm.agent.yaml" {
		t.Errorf("Expected id 'pm.agent.yaml', got '%s'", agent.ID)
	}
	if agent.Name != "John" {
		t.Errorf("Expected name 'John', got '%s'", agent.Name)
	}
	if agent.Title != "Product Manager" {
		t.Errorf("Expected title 'Product Manager', got '%s'", agent.Title)
	}
	if agent.Icon != "📋" {
		t.Errorf("Expected icon '📋', got '%s'", agent.Icon)
	}
}

func TestAgentService_LoadAgents_PersonaExtraction(t *testing.T) {
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	createTestAgentFile(t, agentsDir, "pm.md", validAgentContent())

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	agents, _ := agentService.GetAgents()
	agent := agents[0]

	// Verify persona fields
	if agent.Persona.Role != "Product Manager specializing in collaborative PRD creation." {
		t.Errorf("Expected role 'Product Manager specializing in collaborative PRD creation.', got '%s'", agent.Persona.Role)
	}
	if agent.Persona.Identity != "Product management veteran with 8+ years." {
		t.Errorf("Expected identity 'Product management veteran with 8+ years.', got '%s'", agent.Persona.Identity)
	}
	if agent.Persona.CommunicationStyle != "Asks 'WHY?' relentlessly." {
		t.Errorf("Expected communication_style \"Asks 'WHY?' relentlessly.\", got '%s'", agent.Persona.CommunicationStyle)
	}
}

func TestAgentService_LoadAgents_MenuItemsExtraction(t *testing.T) {
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	createTestAgentFile(t, agentsDir, "pm.md", validAgentContent())

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	agents, _ := agentService.GetAgents()
	agent := agents[0]

	// Verify menu items
	if len(agent.MenuItems) != 3 {
		t.Fatalf("Expected 3 menu items, got %d", len(agent.MenuItems))
	}

	// First item: no workflow or exec
	if agent.MenuItems[0].Cmd != "MH or fuzzy match on menu or help" {
		t.Errorf("Expected cmd 'MH or fuzzy match on menu or help', got '%s'", agent.MenuItems[0].Cmd)
	}
	if agent.MenuItems[0].Label != "[MH] Redisplay Menu Help" {
		t.Errorf("Expected label '[MH] Redisplay Menu Help', got '%s'", agent.MenuItems[0].Label)
	}
	if agent.MenuItems[0].Workflow != nil {
		t.Errorf("Expected nil workflow, got '%v'", agent.MenuItems[0].Workflow)
	}
	if agent.MenuItems[0].Exec != nil {
		t.Errorf("Expected nil exec, got '%v'", agent.MenuItems[0].Exec)
	}

	// Second item: exec path
	if agent.MenuItems[1].Exec == nil {
		t.Fatal("Expected exec to be non-nil")
	}

	// Third item: workflow path
	if agent.MenuItems[2].Workflow == nil {
		t.Fatal("Expected workflow to be non-nil")
	}
}

func TestAgentService_LoadAgents_PathResolution(t *testing.T) {
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	createTestAgentFile(t, agentsDir, "pm.md", validAgentContent())

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	agents, _ := agentService.GetAgents()
	agent := agents[0]

	absRoot, _ := filepath.Abs(tmpDir)

	// Check exec path is resolved
	expectedExec := absRoot + "/_bmad/workflows/prd.md"
	if agent.MenuItems[1].Exec == nil || *agent.MenuItems[1].Exec != expectedExec {
		t.Errorf("Expected exec '%s', got '%v'", expectedExec, agent.MenuItems[1].Exec)
	}

	// Check workflow path is resolved
	expectedWorkflow := absRoot + "/_bmad/workflows/status.yaml"
	if agent.MenuItems[2].Workflow == nil || *agent.MenuItems[2].Workflow != expectedWorkflow {
		t.Errorf("Expected workflow '%s', got '%v'", expectedWorkflow, agent.MenuItems[2].Workflow)
	}

	// Check workflows list
	if len(agent.Workflows) != 2 {
		t.Fatalf("Expected 2 workflows, got %d", len(agent.Workflows))
	}
}

func TestAgentService_LoadAgents_MissingDirectory(t *testing.T) {
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

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	err := agentService.LoadAgents()
	if err == nil {
		t.Fatal("Expected error for missing agents directory")
	}

	agentErr, ok := err.(*AgentServiceError)
	if !ok {
		t.Fatalf("Expected AgentServiceError, got %T", err)
	}
	if agentErr.Code != ErrCodeAgentsNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeAgentsNotFound, agentErr.Code)
	}
}

func TestAgentService_LoadAgents_InvalidYAMLFrontmatter(t *testing.T) {
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	invalidContent := `---
{{{invalid yaml: [broken
---

Some content
`
	createTestAgentFile(t, agentsDir, "invalid.md", invalidContent)

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	err := agentService.LoadAgents()
	if err == nil {
		t.Fatal("Expected error when no valid agents can be loaded")
	}

	// With fault tolerance, single invalid file results in "agents_not_found"
	// because no valid agents could be loaded
	agentErr, ok := err.(*AgentServiceError)
	if !ok {
		t.Fatalf("Expected AgentServiceError, got %T", err)
	}
	if agentErr.Code != ErrCodeAgentsNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeAgentsNotFound, agentErr.Code)
	}
}

func TestAgentService_LoadAgents_MissingXMLContent(t *testing.T) {
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Valid YAML but no XML content
	noXMLContent := `---
name: "test"
description: "Test Agent"
---

Some markdown content without XML code fence.
`
	createTestAgentFile(t, agentsDir, "noxml.md", noXMLContent)

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	err := agentService.LoadAgents()
	if err == nil {
		t.Fatal("Expected error when no valid agents can be loaded")
	}

	// With fault tolerance, single invalid file results in "agents_not_found"
	// because no valid agents could be loaded
	agentErr, ok := err.(*AgentServiceError)
	if !ok {
		t.Fatalf("Expected AgentServiceError, got %T", err)
	}
	if agentErr.Code != ErrCodeAgentsNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeAgentsNotFound, agentErr.Code)
	}
}

func TestAgentService_GetAgent_ByID(t *testing.T) {
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	createTestAgentFile(t, agentsDir, "pm.md", validAgentContent())

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	agent, err := agentService.GetAgent("pm.agent.yaml")
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if agent.ID != "pm.agent.yaml" {
		t.Errorf("Expected id 'pm.agent.yaml', got '%s'", agent.ID)
	}
}

func TestAgentService_GetAgent_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	createTestAgentFile(t, agentsDir, "pm.md", validAgentContent())

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	_, err := agentService.GetAgent("nonexistent.agent.yaml")
	if err == nil {
		t.Fatal("Expected error for nonexistent agent")
	}

	agentErr, ok := err.(*AgentServiceError)
	if !ok {
		t.Fatalf("Expected AgentServiceError, got %T", err)
	}
	if agentErr.Code != ErrCodeAgentNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeAgentNotFound, agentErr.Code)
	}
}

func TestAgentService_ConfigNotLoaded(t *testing.T) {
	configService := NewBMadConfigService()
	// Don't load config

	agentService := NewAgentService(configService)
	err := agentService.LoadAgents()
	if err == nil {
		t.Fatal("Expected error when config not loaded")
	}

	agentErr, ok := err.(*AgentServiceError)
	if !ok {
		t.Fatalf("Expected AgentServiceError, got %T", err)
	}
	if agentErr.Code != ErrCodeAgentConfigNotLoaded {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeAgentConfigNotLoaded, agentErr.Code)
	}
}

func TestAgentService_LoadAgents_FaultTolerance(t *testing.T) {
	// Test that valid agents load even when some files are invalid
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create one valid agent
	createTestAgentFile(t, agentsDir, "valid.md", validAgentContent())

	// Create one invalid agent (bad YAML)
	invalidContent := `---
{{{invalid yaml
---
content
`
	createTestAgentFile(t, agentsDir, "invalid.md", invalidContent)

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	err := agentService.LoadAgents()

	// Should NOT return error - valid agent should load despite invalid one
	if err != nil {
		t.Fatalf("Expected no error with fault tolerance, got: %v", err)
	}

	agents, err := agentService.GetAgents()
	if err != nil {
		t.Fatalf("Expected no error getting agents, got: %v", err)
	}

	// Only the valid agent should be loaded
	if len(agents) != 1 {
		t.Errorf("Expected 1 valid agent to be loaded, got %d", len(agents))
	}

	if agents[0].ID != "pm.agent.yaml" {
		t.Errorf("Expected valid agent to be loaded, got ID: %s", agents[0].ID)
	}
}

func TestAgentService_LoadAgents_DuplicateIDsSkipped(t *testing.T) {
	// Test that duplicate agent IDs are detected and skipped
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create two agents with the same ID
	createTestAgentFile(t, agentsDir, "agent1.md", validAgentContent())
	createTestAgentFile(t, agentsDir, "agent2.md", validAgentContent()) // Same ID: pm.agent.yaml

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	err := agentService.LoadAgents()

	// Should NOT return error - first one loaded, duplicate skipped
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	agents, _ := agentService.GetAgents()

	// Only one agent should be loaded (duplicate skipped)
	if len(agents) != 1 {
		t.Errorf("Expected 1 agent (duplicate skipped), got %d", len(agents))
	}
}

func TestAgentService_LoadAgents_WorkflowsSorted(t *testing.T) {
	// Test that workflows list is deterministically sorted
	tmpDir := t.TempDir()
	agentsDir := filepath.Join(tmpDir, "_bmad", "bmm", "agents")
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		t.Fatal(err)
	}

	createTestAgentFile(t, agentsDir, "pm.md", validAgentContent())

	configContent := `project_name: test
planning_artifacts: ""
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	agentService := NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Get agents multiple times and verify order is consistent
	for i := 0; i < 5; i++ {
		agents, _ := agentService.GetAgents()
		if len(agents[0].Workflows) < 2 {
			t.Skip("Need at least 2 workflows to test sorting")
		}

		// Verify workflows are sorted
		for j := 1; j < len(agents[0].Workflows); j++ {
			if agents[0].Workflows[j-1] > agents[0].Workflows[j] {
				t.Errorf("Workflows not sorted: %v", agents[0].Workflows)
				break
			}
		}
	}
}
