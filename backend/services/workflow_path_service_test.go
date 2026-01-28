package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadPaths_ValidPathFiles(t *testing.T) {
	tmpDir := t.TempDir()

	// Create the BMAD config directory and config
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}

	configContent := `project_name: test
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create the paths directory with a valid path definition
	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	pathContent := `method_name: "BMad Method"
track: "bmad-method"
field_type: "greenfield"
description: "Test description"

phases:
  - phase: 1
    name: "Analysis (Optional)"
    optional: true
    note: "Test note"
    workflows:
      - id: "brainstorm-project"
        exec: "{project-root}/_bmad/core/workflows/brainstorming/workflow.md"
        optional: true
        agent: "analyst"
        command: "/bmad:bmm:workflows:brainstorming"
        included_by: "user_choice"

  - phase: 2
    name: "Planning"
    required: true
    workflows:
      - id: "prd"
        exec: "{project-root}/_bmad/bmm/workflows/2-plan-workflows/prd/workflow.md"
        required: true
        agent: "pm"
        command: "/bmad:bmm:workflows:create-prd"
        output: "Product Requirements Document"

      - id: "create-ux-design"
        conditional: "if_has_ui"
        exec: "{project-root}/_bmad/bmm/workflows/2-plan-workflows/create-ux-design/workflow.md"
        agent: "ux-designer"
        command: "/bmad:bmm:workflows:create-ux-design"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create and load config service first
	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Create and test workflow path service
	pathSvc := NewWorkflowPathService(configSvc)
	err := pathSvc.LoadPaths()
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify phases were loaded
	resp, err := pathSvc.GetPhases()
	if err != nil {
		t.Fatalf("GetPhases failed: %v", err)
	}

	if resp.MethodName != "BMad Method" {
		t.Errorf("Expected method_name 'BMad Method', got '%s'", resp.MethodName)
	}
	if resp.Track != "bmad-method" {
		t.Errorf("Expected track 'bmad-method', got '%s'", resp.Track)
	}
	if resp.FieldType != "greenfield" {
		t.Errorf("Expected field_type 'greenfield', got '%s'", resp.FieldType)
	}
	if len(resp.Phases) != 2 {
		t.Errorf("Expected 2 phases, got %d", len(resp.Phases))
	}
}

func TestLoadPaths_ResolvesProjectRootPlaceholders(t *testing.T) {
	tmpDir := t.TempDir()

	// Create config
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

	// Create paths
	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	pathContent := `method_name: "Test Method"
track: "bmad-method"
field_type: "greenfield"
description: "Test"

phases:
  - phase: 1
    name: "Test Phase"
    required: true
    workflows:
      - id: "test-workflow"
        exec: "{project-root}/test/path.md"
        required: true
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	resp, err := pathSvc.GetPhases()
	if err != nil {
		t.Fatal(err)
	}

	absRoot, _ := filepath.Abs(tmpDir)
	expectedExec := absRoot + "/test/path.md"
	if len(resp.Phases) == 0 || len(resp.Phases[0].Workflows) == 0 {
		t.Fatal("Expected at least one phase with one workflow")
	}
	if resp.Phases[0].Workflows[0].Exec == nil || *resp.Phases[0].Workflows[0].Exec != expectedExec {
		got := "<nil>"
		if resp.Phases[0].Workflows[0].Exec != nil {
			got = *resp.Phases[0].Workflows[0].Exec
		}
		t.Errorf("Expected exec '%s', got '%s'", expectedExec, got)
	}
}

func TestLoadPaths_ConditionalWorkflowsHaveConditionType(t *testing.T) {
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

	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	pathContent := `method_name: "Test"
track: "bmad-method"
field_type: "greenfield"
description: "Test"

phases:
  - phase: 1
    name: "Planning"
    required: true
    workflows:
      - id: "conditional-workflow"
        conditional: "if_has_ui"
        exec: "{project-root}/test.md"
        agent: "ux-designer"
        command: "/test"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	resp, err := pathSvc.GetPhases()
	if err != nil {
		t.Fatal(err)
	}

	if len(resp.Phases) == 0 || len(resp.Phases[0].Workflows) == 0 {
		t.Fatal("Expected at least one phase with one workflow")
	}

	wf := resp.Phases[0].Workflows[0]
	if wf.Conditional == nil || *wf.Conditional != "if_has_ui" {
		t.Error("Expected conditional to be 'if_has_ui'")
	}
	if wf.ConditionType == nil || *wf.ConditionType != "if_has_ui" {
		t.Error("Expected condition_type to be 'if_has_ui'")
	}
}

func TestLoadPaths_WorkflowFieldMapsToExec(t *testing.T) {
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

	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Use 'workflow' field instead of 'exec' - this is used in some path definitions
	pathContent := `method_name: "Test"
track: "bmad-method"
field_type: "greenfield"
description: "Test"

phases:
  - phase: 1
    name: "Planning"
    required: true
    workflows:
      - id: "workflow-field-test"
        workflow: "{project-root}/test/workflow.yaml"
        required: true
        agent: "tea"
        command: "/test"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "bmad-method.yaml"), []byte(pathContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	resp, err := pathSvc.GetPhases()
	if err != nil {
		t.Fatal(err)
	}

	if len(resp.Phases) == 0 || len(resp.Phases[0].Workflows) == 0 {
		t.Fatal("Expected at least one phase with one workflow")
	}

	wf := resp.Phases[0].Workflows[0]
	absRoot, _ := filepath.Abs(tmpDir)
	expectedExec := absRoot + "/test/workflow.yaml"

	if wf.Exec == nil {
		t.Fatal("Expected Exec to be non-nil when workflow field is used")
	}
	if *wf.Exec != expectedExec {
		t.Errorf("Expected Exec '%s', got '%s'", expectedExec, *wf.Exec)
	}
}

func TestLoadPaths_IncludedByAndPurposeFieldsTransferred(t *testing.T) {
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

	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	pathContent := `method_name: "Test"
track: "bmad-method"
field_type: "greenfield"
description: "Test"

phases:
  - phase: 1
    name: "Analysis"
    optional: true
    workflows:
      - id: "optional-workflow"
        exec: "{project-root}/test.md"
        optional: true
        agent: "analyst"
        command: "/test"
        included_by: "user_choice"
        purpose: "Understand existing codebase"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "bmad-method.yaml"), []byte(pathContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	resp, err := pathSvc.GetPhases()
	if err != nil {
		t.Fatal(err)
	}

	if len(resp.Phases) == 0 || len(resp.Phases[0].Workflows) == 0 {
		t.Fatal("Expected at least one phase with one workflow")
	}

	wf := resp.Phases[0].Workflows[0]

	if wf.IncludedBy == nil || *wf.IncludedBy != "user_choice" {
		t.Error("Expected included_by to be 'user_choice'")
	}
	if wf.Purpose == nil || *wf.Purpose != "Understand existing codebase" {
		t.Error("Expected purpose to be 'Understand existing codebase'")
	}
}

func TestLoadPaths_MissingPathDirectoryReturnsError(t *testing.T) {
	tmpDir := t.TempDir()

	// Create config but no paths directory
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

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	err := pathSvc.LoadPaths()
	if err == nil {
		t.Fatal("Expected error for missing paths directory")
	}

	pathErr, ok := err.(*WorkflowPathError)
	if !ok {
		t.Fatalf("Expected WorkflowPathError, got %T", err)
	}
	if pathErr.Code != ErrCodePathFilesNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodePathFilesNotFound, pathErr.Code)
	}
}

func TestLoadPaths_InvalidYAMLReturnsError(t *testing.T) {
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

	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	invalidYAML := `{{{invalid yaml: [broken`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(invalidYAML), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	err := pathSvc.LoadPaths()
	if err == nil {
		t.Fatal("Expected error for invalid YAML")
	}

	pathErr, ok := err.(*WorkflowPathError)
	if !ok {
		t.Fatalf("Expected WorkflowPathError, got %T", err)
	}
	if pathErr.Code != ErrCodeInvalidPathDefinition {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeInvalidPathDefinition, pathErr.Code)
	}
}

func TestLoadPaths_DefaultTrackWhenStatusFileMissing(t *testing.T) {
	tmpDir := t.TempDir()

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

	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	pathContent := `method_name: "Default Track"
track: "bmad-method"
field_type: "greenfield"
description: "Test"
phases: []
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathContent), 0644); err != nil {
		t.Fatal(err)
	}

	// No workflow status file created - should default to bmad-method
	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	track := pathSvc.GetSelectedTrack()
	if track != "bmad-method" {
		t.Errorf("Expected default track 'bmad-method', got '%s'", track)
	}
}

func TestLoadPaths_ReadsTrackFromStatusFile(t *testing.T) {
	tmpDir := t.TempDir()

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

	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create brownfield path
	brownfieldContent := `method_name: "Brownfield Method"
track: "method-brownfield"
field_type: "brownfield"
description: "Brownfield test"
phases: []
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-brownfield.yaml"), []byte(brownfieldContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create greenfield path too
	greenfieldContent := `method_name: "Greenfield Method"
track: "bmad-method"
field_type: "greenfield"
description: "Greenfield test"
phases: []
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(greenfieldContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create workflow status file specifying brownfield track
	statusDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	if err := os.MkdirAll(statusDir, 0755); err != nil {
		t.Fatal(err)
	}
	statusContent := `track: method-brownfield
`
	if err := os.WriteFile(filepath.Join(statusDir, "bmm-workflow-status.yaml"), []byte(statusContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	track := pathSvc.GetSelectedTrack()
	if track != "method-brownfield" {
		t.Errorf("Expected track 'method-brownfield' from status file, got '%s'", track)
	}

	resp, err := pathSvc.GetPhases()
	if err != nil {
		t.Fatal(err)
	}
	if resp.Track != "method-brownfield" {
		t.Errorf("Expected phases response track 'method-brownfield', got '%s'", resp.Track)
	}
}

func TestGetPhases_ConfigNotLoadedReturnsError(t *testing.T) {
	configSvc := NewBMadConfigService()
	// Don't load config

	pathSvc := NewWorkflowPathService(configSvc)
	err := pathSvc.LoadPaths()
	if err == nil {
		t.Fatal("Expected error when config not loaded")
	}

	pathErr, ok := err.(*WorkflowPathError)
	if !ok {
		t.Fatalf("Expected WorkflowPathError, got %T", err)
	}
	if pathErr.Code != ErrCodeConfigNotLoaded {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeConfigNotLoaded, pathErr.Code)
	}
}

func TestGetPhases_PathsNotLoadedReturnsError(t *testing.T) {
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

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	// Don't call LoadPaths

	_, err := pathSvc.GetPhases()
	if err == nil {
		t.Fatal("Expected error when paths not loaded")
	}

	pathErr, ok := err.(*WorkflowPathError)
	if !ok {
		t.Fatalf("Expected WorkflowPathError, got %T", err)
	}
	if pathErr.Code != ErrCodePathFilesNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodePathFilesNotFound, pathErr.Code)
	}
}

func TestLoadPaths_TrackNotFoundReturnsError(t *testing.T) {
	tmpDir := t.TempDir()

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

	pathsDir := filepath.Join(tmpDir, "_bmad", "bmm", "workflows", "workflow-status", "paths")
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Only create brownfield path
	brownfieldContent := `method_name: "Brownfield Method"
track: "method-brownfield"
field_type: "brownfield"
description: "Test"
phases: []
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-brownfield.yaml"), []byte(brownfieldContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create status file pointing to nonexistent greenfield track
	statusDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	if err := os.MkdirAll(statusDir, 0755); err != nil {
		t.Fatal(err)
	}
	statusContent := `track: method-greenfield
`
	if err := os.WriteFile(filepath.Join(statusDir, "bmm-workflow-status.yaml"), []byte(statusContent), 0644); err != nil {
		t.Fatal(err)
	}

	configSvc := NewBMadConfigService()
	if err := configSvc.LoadConfig(tmpDir); err != nil {
		t.Fatal(err)
	}

	pathSvc := NewWorkflowPathService(configSvc)
	// LoadPaths should succeed (it loads all available paths)
	if err := pathSvc.LoadPaths(); err != nil {
		t.Fatal(err)
	}

	// GetPhases should fail because selected track doesn't exist
	_, err := pathSvc.GetPhases()
	if err == nil {
		t.Fatal("Expected error when selected track not found")
	}

	pathErr, ok := err.(*WorkflowPathError)
	if !ok {
		t.Fatalf("Expected WorkflowPathError, got %T", err)
	}
	if pathErr.Code != ErrCodeTrackNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeTrackNotFound, pathErr.Code)
	}
}
