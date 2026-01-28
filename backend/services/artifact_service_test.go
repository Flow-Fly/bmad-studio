package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"bmad-studio/backend/types"
)

// Helper to create a test config service
func setupArtifactTestConfig(t *testing.T) (*BMadConfigService, string) {
	t.Helper()

	tmpDir := t.TempDir()
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	if err := os.MkdirAll(bmadDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		t.Fatal(err)
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

	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	return configService, tmpDir
}

func TestLoadArtifacts_ScansRecursively(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	// Create nested directory structure
	planningDir := filepath.Join(outputDir, "planning-artifacts")
	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create test markdown file
	prdContent := `---
status: complete
workflowType: prd
---
# Product Requirements Document

This is a PRD.
`
	if err := os.WriteFile(filepath.Join(planningDir, "prd.md"), []byte(prdContent), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	artifacts, err := service.GetArtifacts()
	if err != nil {
		t.Fatalf("GetArtifacts() error = %v", err)
	}

	if len(artifacts) != 1 {
		t.Errorf("Expected 1 artifact, got %d", len(artifacts))
	}

	if len(artifacts) > 0 {
		if artifacts[0].Type != types.ArtifactTypePRD {
			t.Errorf("Expected type 'prd', got '%s'", artifacts[0].Type)
		}
	}
}

func TestLoadArtifacts_StepsCompletedAsStrings(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	content := `---
status: complete
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-review
workflowType: prd
---
# PRD with string steps
`
	if err := os.WriteFile(filepath.Join(outputDir, "prd.md"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	artifacts, _ := service.GetArtifacts()
	if len(artifacts) != 1 {
		t.Fatalf("Expected 1 artifact, got %d", len(artifacts))
	}

	expected := []string{"step-01-init", "step-02-discovery", "step-03-review"}
	if len(artifacts[0].StepsCompleted) != len(expected) {
		t.Errorf("Expected %d steps, got %d", len(expected), len(artifacts[0].StepsCompleted))
	}
	for i, step := range expected {
		if artifacts[0].StepsCompleted[i] != step {
			t.Errorf("Step %d: expected '%s', got '%s'", i, step, artifacts[0].StepsCompleted[i])
		}
	}
}

func TestLoadArtifacts_StepsCompletedAsInts(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	content := `---
status: complete
stepsCompleted: [1, 2, 3, 4, 5]
workflowType: architecture
---
# Architecture with int steps
`
	if err := os.WriteFile(filepath.Join(outputDir, "architecture.md"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	artifacts, _ := service.GetArtifacts()
	if len(artifacts) != 1 {
		t.Fatalf("Expected 1 artifact, got %d", len(artifacts))
	}

	expected := []string{"step-1", "step-2", "step-3", "step-4", "step-5"}
	if len(artifacts[0].StepsCompleted) != len(expected) {
		t.Errorf("Expected %d steps, got %d", len(expected), len(artifacts[0].StepsCompleted))
	}
	for i, step := range expected {
		if artifacts[0].StepsCompleted[i] != step {
			t.Errorf("Step %d: expected '%s', got '%s'", i, step, artifacts[0].StepsCompleted[i])
		}
	}
}

func TestClassifyByFilename_AllTypes(t *testing.T) {
	service := &ArtifactService{}

	tests := []struct {
		path     string
		expected string
	}{
		{"product-brief-project.md", types.ArtifactTypeProductBrief},
		{"prd.md", types.ArtifactTypePRD},
		{"prd-validation-report.md", types.ArtifactTypeValidationReport},
		{"architecture.md", types.ArtifactTypeArchitecture},
		{"epics.md", types.ArtifactTypeEpics},
		{"0-1-parse-config.md", types.ArtifactTypeStories},
		{"1-2-user-auth.md", types.ArtifactTypeStories},
		{"ux-design.md", types.ArtifactTypeUXDesign},
		{"ux-design-spec/index.md", types.ArtifactTypeUXDesign},
		{"research/index.md", types.ArtifactTypeResearch},
		{"brainstorming/ideas.md", types.ArtifactTypeBrainstorming},
		{"project-context.md", types.ArtifactTypeProjectContext},
		{"random-file.md", types.ArtifactTypeOther},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			result := service.classifyByFilename(tt.path)
			if result != tt.expected {
				t.Errorf("classifyByFilename(%q) = %q, want %q", tt.path, result, tt.expected)
			}
		})
	}
}

func TestClassifyByFrontmatter(t *testing.T) {
	service := &ArtifactService{}

	tests := []struct {
		workflowType string
		expected     string
	}{
		{"prd", types.ArtifactTypePRD},
		{"architecture", types.ArtifactTypeArchitecture},
		{"create-architecture", types.ArtifactTypeArchitecture},
		{"create-epics-and-stories", types.ArtifactTypeEpics},
		{"create-story", types.ArtifactTypeStories},
		{"create-ux-design", types.ArtifactTypeUXDesign},
		{"research", types.ArtifactTypeResearch},
		{"brainstorming", types.ArtifactTypeBrainstorming},
		{"create-product-brief", types.ArtifactTypeProductBrief},
		{"validate", types.ArtifactTypeValidationReport},
		{"generate-project-context", types.ArtifactTypeProjectContext},
		{"unknown-workflow", types.ArtifactTypeOther},
	}

	for _, tt := range tests {
		t.Run(tt.workflowType, func(t *testing.T) {
			fm := &types.ArtifactFrontmatter{WorkflowType: tt.workflowType}
			result := service.classifyByFrontmatter(fm)
			if result != tt.expected {
				t.Errorf("classifyByFrontmatter(%q) = %q, want %q", tt.workflowType, result, tt.expected)
			}
		})
	}
}

func TestShardedArtifactDetection(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	// Create sharded artifact directory
	shardedDir := filepath.Join(outputDir, "ux-design-spec")
	if err := os.MkdirAll(shardedDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create index.md
	indexContent := `---
workflowType: create-ux-design
status: complete
---
# UX Design Index
`
	if err := os.WriteFile(filepath.Join(shardedDir, "index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create child files
	child1Content := `# Navigation Design`
	if err := os.WriteFile(filepath.Join(shardedDir, "navigation.md"), []byte(child1Content), 0644); err != nil {
		t.Fatal(err)
	}

	child2Content := `# Typography Design`
	if err := os.WriteFile(filepath.Join(shardedDir, "typography.md"), []byte(child2Content), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	artifacts, _ := service.GetArtifacts()
	// Now returns 3 artifacts: 1 parent + 2 children (children are queryable)
	if len(artifacts) != 3 {
		t.Errorf("Expected 3 artifacts (parent + 2 children), got %d", len(artifacts))
	}

	// Find the parent artifact (the one with IsSharded=true)
	var parent *types.ArtifactResponse
	var children []*types.ArtifactResponse
	for i := range artifacts {
		if artifacts[i].IsSharded {
			parent = &artifacts[i]
		} else if artifacts[i].ParentID != nil {
			children = append(children, &artifacts[i])
		}
	}

	if parent == nil {
		t.Fatal("Expected to find parent artifact with IsSharded=true")
	}

	if len(parent.Children) != 2 {
		t.Errorf("Expected parent to have 2 children, got %d", len(parent.Children))
	}

	if len(children) != 2 {
		t.Errorf("Expected 2 child artifacts, got %d", len(children))
	}

	// Verify children have ParentID set correctly
	for _, child := range children {
		if child.ParentID == nil {
			t.Error("Expected child to have ParentID set")
		} else if *child.ParentID != parent.ID {
			t.Errorf("Child ParentID = %s, want %s", *child.ParentID, parent.ID)
		}
	}

	// Verify children can be queried individually
	for _, childID := range parent.Children {
		childArtifact, err := service.GetArtifact(childID)
		if err != nil {
			t.Errorf("GetArtifact(%s) error = %v", childID, err)
		}
		if childArtifact == nil {
			t.Errorf("GetArtifact(%s) returned nil", childID)
		}
	}
}

func TestMissingFrontmatter_HandledGracefully(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	// Create file without frontmatter
	content := `# Story 0.5: Build Artifact Registry

Status: ready-for-dev

## Story
As a developer...
`
	if err := os.WriteFile(filepath.Join(outputDir, "0-5-build-artifact-registry.md"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v, want nil", err)
	}

	artifacts, _ := service.GetArtifacts()
	if len(artifacts) != 1 {
		t.Fatalf("Expected 1 artifact, got %d", len(artifacts))
	}

	// Should classify by filename and extract name from H1
	if artifacts[0].Type != types.ArtifactTypeStories {
		t.Errorf("Expected type 'stories', got '%s'", artifacts[0].Type)
	}
	if artifacts[0].Name != "Story 0.5: Build Artifact Registry" {
		t.Errorf("Expected name from H1, got '%s'", artifacts[0].Name)
	}
}

func TestInvalidYAML_LoggedAndSkipped(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	// Create file with invalid YAML
	content := `---
status: [invalid: yaml
---
# Some content
`
	if err := os.WriteFile(filepath.Join(outputDir, "invalid.md"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	// Create a valid file too
	validContent := `---
status: complete
workflowType: prd
---
# Valid PRD
`
	if err := os.WriteFile(filepath.Join(outputDir, "valid-prd.md"), []byte(validContent), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v, want nil (should continue on invalid files)", err)
	}

	artifacts, _ := service.GetArtifacts()
	// Should have at least the valid one (invalid might be included with nil frontmatter)
	found := false
	for _, a := range artifacts {
		if a.Type == types.ArtifactTypePRD {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected to find valid PRD artifact")
	}
}

func TestGetArtifacts_ReturnsSortedList(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	// Create files in non-alphabetical order
	files := []string{"zebra.md", "alpha.md", "middle.md"}
	for _, f := range files {
		content := "# " + strings.TrimSuffix(f, ".md")
		if err := os.WriteFile(filepath.Join(outputDir, f), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	artifacts, _ := service.GetArtifacts()
	if len(artifacts) != 3 {
		t.Fatalf("Expected 3 artifacts, got %d", len(artifacts))
	}

	// Check sorted by ID
	for i := 1; i < len(artifacts); i++ {
		if artifacts[i-1].ID > artifacts[i].ID {
			t.Errorf("Artifacts not sorted: %s > %s", artifacts[i-1].ID, artifacts[i].ID)
		}
	}
}

func TestGetArtifact_ReturnsCorrectArtifact(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	content := `---
status: complete
workflowType: prd
---
# My PRD
`
	if err := os.WriteFile(filepath.Join(outputDir, "prd.md"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	artifact, err := service.GetArtifact("_bmad-output-prd")
	if err != nil {
		t.Fatalf("GetArtifact() error = %v", err)
	}

	if artifact.Name != "My PRD" {
		t.Errorf("Expected name 'My PRD', got '%s'", artifact.Name)
	}
}

func TestGetArtifact_ReturnsErrorForUnknownID(t *testing.T) {
	configService, _ := setupArtifactTestConfig(t)

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	_, err := service.GetArtifact("nonexistent-id")
	if err == nil {
		t.Error("Expected error for unknown ID, got nil")
	}

	svcErr, ok := err.(*ArtifactServiceError)
	if !ok {
		t.Errorf("Expected ArtifactServiceError, got %T", err)
	}
	if svcErr.Code != ErrCodeArtifactNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeArtifactNotFound, svcErr.Code)
	}
}

func TestRegistryPersistence_RoundTrip(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	content := `---
status: complete
workflowType: prd
completedAt: "2026-01-27"
---
# My PRD
`
	if err := os.WriteFile(filepath.Join(outputDir, "prd.md"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	// First service loads and saves
	service1 := NewArtifactService(configService, nil)
	if err := service1.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	// Verify registry file was created
	registryPath := filepath.Join(outputDir, "artifact-registry.json")
	if _, err := os.Stat(registryPath); os.IsNotExist(err) {
		t.Fatal("Expected registry file to be created")
	}

	// Read registry directly
	data, err := os.ReadFile(registryPath)
	if err != nil {
		t.Fatalf("Failed to read registry: %v", err)
	}

	var wrapper types.ArtifactsResponse
	if err := json.Unmarshal(data, &wrapper); err != nil {
		t.Fatalf("Failed to parse registry: %v", err)
	}

	if len(wrapper.Artifacts) != 1 {
		t.Errorf("Expected 1 artifact in registry, got %d", len(wrapper.Artifacts))
	}
}

func TestConcurrentAccess_ThreadSafe(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	// Create several files
	for i := 0; i < 10; i++ {
		content := "# File " + string(rune('A'+i))
		if err := os.WriteFile(filepath.Join(outputDir, string(rune('a'+i))+".md"), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	// Concurrent reads
	var wg sync.WaitGroup
	errors := make(chan error, 100)

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := service.GetArtifacts()
			if err != nil {
				errors <- err
			}
		}()
	}

	wg.Wait()
	close(errors)

	for err := range errors {
		t.Errorf("Concurrent GetArtifacts() error: %v", err)
	}
}

func TestGetPhaseInfo(t *testing.T) {
	service := &ArtifactService{}

	tests := []struct {
		artifactType  string
		expectedPhase int
		expectedName  string
	}{
		{types.ArtifactTypeResearch, 1, "Analysis"},
		{types.ArtifactTypeBrainstorming, 1, "Analysis"},
		{types.ArtifactTypeProductBrief, 1, "Analysis"},
		{types.ArtifactTypePRD, 2, "Planning"},
		{types.ArtifactTypeUXDesign, 2, "Planning"},
		{types.ArtifactTypeArchitecture, 3, "Solutioning"},
		{types.ArtifactTypeEpics, 3, "Solutioning"},
		{types.ArtifactTypeValidationReport, 3, "Solutioning"},
		{types.ArtifactTypeStories, 4, "Implementation"},
		{types.ArtifactTypeProjectContext, 0, "Meta"},
		{types.ArtifactTypeOther, 0, "Meta"},
	}

	for _, tt := range tests {
		t.Run(tt.artifactType, func(t *testing.T) {
			phase, name := service.getPhaseInfo(tt.artifactType)
			if phase != tt.expectedPhase {
				t.Errorf("getPhaseInfo(%s) phase = %d, want %d", tt.artifactType, phase, tt.expectedPhase)
			}
			if name != tt.expectedName {
				t.Errorf("getPhaseInfo(%s) name = %s, want %s", tt.artifactType, name, tt.expectedName)
			}
		})
	}
}

func TestDetermineStatus(t *testing.T) {
	service := &ArtifactService{}

	tests := []struct {
		name           string
		frontmatter    *types.ArtifactFrontmatter
		content        string
		expectedStatus string
	}{
		{
			name:           "Frontmatter complete",
			frontmatter:    &types.ArtifactFrontmatter{Status: "complete"},
			content:        "",
			expectedStatus: types.ArtifactStatusComplete,
		},
		{
			name:           "Frontmatter in-progress",
			frontmatter:    &types.ArtifactFrontmatter{Status: "in-progress"},
			content:        "",
			expectedStatus: types.ArtifactStatusInProgress,
		},
		{
			name:           "Content Status: done",
			frontmatter:    nil,
			content:        "Status: done\n",
			expectedStatus: types.ArtifactStatusComplete,
		},
		{
			name:           "Content Status: ready-for-dev",
			frontmatter:    nil,
			content:        "Status: ready-for-dev\n",
			expectedStatus: types.ArtifactStatusNotStarted,
		},
		{
			name:           "No status",
			frontmatter:    nil,
			content:        "# Just content",
			expectedStatus: types.ArtifactStatusNotStarted,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.determineStatus(tt.frontmatter, []byte(tt.content))
			if result != tt.expectedStatus {
				t.Errorf("determineStatus() = %s, want %s", result, tt.expectedStatus)
			}
		})
	}
}

func TestSkipStatusFiles(t *testing.T) {
	configService, tmpDir := setupArtifactTestConfig(t)
	outputDir := filepath.Join(tmpDir, "_bmad-output")

	// Create a status file that should be skipped
	if err := os.WriteFile(filepath.Join(outputDir, "sprint-status.yaml"), []byte("test: content"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outputDir, "bmm-workflow-status.yaml"), []byte("test: content"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create a valid artifact
	if err := os.WriteFile(filepath.Join(outputDir, "prd.md"), []byte("# PRD"), 0644); err != nil {
		t.Fatal(err)
	}

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v", err)
	}

	artifacts, _ := service.GetArtifacts()
	// Should only have the prd.md, not the status files
	if len(artifacts) != 1 {
		t.Errorf("Expected 1 artifact, got %d (should skip status files)", len(artifacts))
	}
}

func TestEmptyOutputFolder(t *testing.T) {
	configService, _ := setupArtifactTestConfig(t)

	service := NewArtifactService(configService, nil)
	if err := service.LoadArtifacts(); err != nil {
		t.Fatalf("LoadArtifacts() error = %v, want nil for empty folder", err)
	}

	artifacts, _ := service.GetArtifacts()
	if len(artifacts) != 0 {
		t.Errorf("Expected 0 artifacts for empty folder, got %d", len(artifacts))
	}
}

func TestToTitleCase(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello world", "Hello World"},
		{"HELLO WORLD", "Hello World"},
		{"hello", "Hello"},
		{"", ""},
		{"a b c", "A B C"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toTitleCase(tt.input)
			if result != tt.expected {
				t.Errorf("toTitleCase(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestParseFrontmatter_BoundsCheck(t *testing.T) {
	service := &ArtifactService{}

	// Test with content shorter than 3 bytes
	shortContent := []byte("ab")
	result, err := service.parseFrontmatter(shortContent)
	if err != nil {
		t.Errorf("parseFrontmatter() error = %v, want nil", err)
	}
	if result != nil {
		t.Error("parseFrontmatter() returned non-nil for short content")
	}

	// Test with empty content
	emptyContent := []byte("")
	result, err = service.parseFrontmatter(emptyContent)
	if err != nil {
		t.Errorf("parseFrontmatter() error = %v, want nil", err)
	}
	if result != nil {
		t.Error("parseFrontmatter() returned non-nil for empty content")
	}
}

func TestNormalizeStepsCompleted(t *testing.T) {
	service := &ArtifactService{}

	tests := []struct {
		name     string
		input    interface{}
		expected []string
	}{
		{
			name:     "nil input",
			input:    nil,
			expected: nil,
		},
		{
			name:     "string slice",
			input:    []interface{}{"step-1", "step-2"},
			expected: []string{"step-1", "step-2"},
		},
		{
			name:     "int slice",
			input:    []interface{}{float64(1), float64(2), float64(3)}, // YAML parses ints as float64
			expected: []string{"step-1", "step-2", "step-3"},
		},
		{
			name:     "mixed (should handle gracefully)",
			input:    []interface{}{"step-a", float64(2)},
			expected: []string{"step-a", "step-2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.normalizeStepsCompleted(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("normalizeStepsCompleted() len = %d, want %d", len(result), len(tt.expected))
				return
			}
			for i, v := range result {
				if v != tt.expected[i] {
					t.Errorf("normalizeStepsCompleted()[%d] = %s, want %s", i, v, tt.expected[i])
				}
			}
		})
	}
}
