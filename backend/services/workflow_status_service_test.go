package services

import (
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/types"
)

func TestWorkflowStatusService_ParseWorkflowStatus(t *testing.T) {
	// Create a temp directory for test fixtures
	tmpDir, err := os.MkdirTemp("", "workflow-status-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up directory structure
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")

	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatalf("Failed to create planning dir: %v", err)
	}
	if err := os.MkdirAll(implDir, 0755); err != nil {
		t.Fatalf("Failed to create impl dir: %v", err)
	}
	if err := os.MkdirAll(pathsDir, 0755); err != nil {
		t.Fatalf("Failed to create paths dir: %v", err)
	}

	// Create a path definition file for testing
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
      - id: "create-ux-design"
        required: true
        optional: false
        agent: "ux-designer"
  - phase: 3
    name: "Solutioning"
    required: true
    optional: false
    workflows:
      - id: "create-architecture"
        required: true
        optional: false
        agent: "architect"
      - id: "create-epics-and-stories"
        required: true
        optional: false
        agent: "pm"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatalf("Failed to write path definition: %v", err)
	}

	// Create BMAD config
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	tests := []struct {
		name               string
		workflowStatusYAML string
		wantErr            bool
		wantComplete       map[string]bool // workflow ID -> expected isComplete
	}{
		{
			name: "valid workflow status with file paths",
			workflowStatusYAML: `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: "_bmad-output/planning-artifacts/brainstorming.md"
  product-brief: "_bmad-output/planning-artifacts/product-brief.md"
  prd: "_bmad-output/planning-artifacts/prd.md"
  create-ux-design: "_bmad-output/planning-artifacts/ux-design/index.md"
  create-architecture: required
  create-epics-and-stories: required
`,
			wantErr: false,
			wantComplete: map[string]bool{
				"brainstorm-project":       true,
				"product-brief":            true,
				"prd":                      true,
				"create-ux-design":         true,
				"create-architecture":      false,
				"create-epics-and-stories": false,
			},
		},
		{
			name: "workflow status with skipped workflow",
			workflowStatusYAML: `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: skipped
  product-brief: "_bmad-output/planning-artifacts/product-brief.md"
  prd: required
`,
			wantErr: false,
			wantComplete: map[string]bool{
				"brainstorm-project": true, // skipped counts as complete
				"product-brief":      true,
				"prd":                false,
			},
		},
		{
			name: "workflow status with various statuses",
			workflowStatusYAML: `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: optional
  product-brief: recommended
  prd: required
  create-ux-design: conditional
`,
			wantErr: false,
			wantComplete: map[string]bool{
				"brainstorm-project": false, // optional not complete
				"product-brief":      false, // recommended not complete
				"prd":                false, // required not complete
				"create-ux-design":   false, // conditional not complete
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Write workflow status file
			statusPath := filepath.Join(planningDir, "bmm-workflow-status.yaml")
			if err := os.WriteFile(statusPath, []byte(tt.workflowStatusYAML), 0644); err != nil {
				t.Fatalf("Failed to write workflow status: %v", err)
			}

			// Set up services
			configService := NewBMadConfigService()
			if err := configService.LoadConfig(tmpDir); err != nil {
				t.Fatalf("Failed to load config: %v", err)
			}

			pathService := NewWorkflowPathService(configService)
			if err := pathService.LoadPaths(); err != nil {
				t.Fatalf("Failed to load paths: %v", err)
			}

			statusService := NewWorkflowStatusService(configService, pathService)
			if err := statusService.LoadStatus(); err != nil {
				if !tt.wantErr {
					t.Fatalf("LoadStatus() error = %v, wantErr %v", err, tt.wantErr)
				}
				return
			}
			if tt.wantErr {
				t.Fatalf("LoadStatus() expected error but got none")
			}

			// Check workflow completion statuses
			status, err := statusService.GetStatus()
			if err != nil {
				t.Fatalf("GetStatus() error = %v", err)
			}

			for wfID, wantComplete := range tt.wantComplete {
				wfStatus, ok := status.WorkflowStatuses[wfID]
				if !ok {
					t.Errorf("Workflow %s not found in status response", wfID)
					continue
				}
				if wfStatus.IsComplete != wantComplete {
					t.Errorf("Workflow %s: IsComplete = %v, want %v", wfID, wfStatus.IsComplete, wantComplete)
				}
			}
		})
	}
}

func TestWorkflowStatusService_ParseSprintStatus(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "sprint-status-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up directory structure
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")

	for _, dir := range []string{planningDir, implDir, pathsDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create dir %s: %v", dir, err)
		}
	}

	// Create minimal path definition
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
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatalf("Failed to write path definition: %v", err)
	}

	// Create BMAD config
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	// Create workflow status file
	workflowStatusContent := `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: "_bmad-output/brainstorming.md"
`
	if err := os.WriteFile(filepath.Join(planningDir, "bmm-workflow-status.yaml"), []byte(workflowStatusContent), 0644); err != nil {
		t.Fatalf("Failed to write workflow status: %v", err)
	}

	tests := []struct {
		name             string
		sprintStatusYAML string
		wantStoryCount   int
		wantStatuses     map[string]string
	}{
		{
			name: "valid sprint status with multiple stories",
			sprintStatusYAML: `generated: 2026-01-27
project: test-project
project_key: test-project
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  epic-0: in-progress
  0-1-story-one: done
  0-2-story-two: in-progress
  0-3-story-three: ready-for-dev
  0-4-story-four: backlog
`,
			wantStoryCount: 5, // includes epic
			wantStatuses: map[string]string{
				"epic-0":          "in-progress",
				"0-1-story-one":   "done",
				"0-2-story-two":   "in-progress",
				"0-3-story-three": "ready-for-dev",
				"0-4-story-four":  "backlog",
			},
		},
		{
			name: "sprint status with review status",
			sprintStatusYAML: `generated: 2026-01-27
project: test-project
project_key: test-project
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

development_status:
  epic-1: in-progress
  1-1-feature: review
`,
			wantStoryCount: 2,
			wantStatuses: map[string]string{
				"epic-1":      "in-progress",
				"1-1-feature": "review",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Write sprint status file
			statusPath := filepath.Join(implDir, "sprint-status.yaml")
			if err := os.WriteFile(statusPath, []byte(tt.sprintStatusYAML), 0644); err != nil {
				t.Fatalf("Failed to write sprint status: %v", err)
			}

			// Set up services
			configService := NewBMadConfigService()
			if err := configService.LoadConfig(tmpDir); err != nil {
				t.Fatalf("Failed to load config: %v", err)
			}

			pathService := NewWorkflowPathService(configService)
			if err := pathService.LoadPaths(); err != nil {
				t.Fatalf("Failed to load paths: %v", err)
			}

			statusService := NewWorkflowStatusService(configService, pathService)
			if err := statusService.LoadStatus(); err != nil {
				t.Fatalf("LoadStatus() error = %v", err)
			}

			status, err := statusService.GetStatus()
			if err != nil {
				t.Fatalf("GetStatus() error = %v", err)
			}

			// Check story statuses
			if len(status.StoryStatuses) != tt.wantStoryCount {
				t.Errorf("StoryStatuses count = %d, want %d", len(status.StoryStatuses), tt.wantStoryCount)
			}

			for storyID, wantStatus := range tt.wantStatuses {
				gotStatus, ok := status.StoryStatuses[storyID]
				if !ok {
					t.Errorf("Story %s not found in status response", storyID)
					continue
				}
				if gotStatus != wantStatus {
					t.Errorf("Story %s: status = %s, want %s", storyID, gotStatus, wantStatus)
				}
			}
		})
	}
}

func TestWorkflowStatusService_ComputeCurrentPhase(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "current-phase-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up directory structure
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")

	for _, dir := range []string{planningDir, implDir, pathsDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create dir %s: %v", dir, err)
		}
	}

	// Create path definition with multiple phases
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
  - phase: 3
    name: "Solutioning"
    required: true
    optional: false
    workflows:
      - id: "create-architecture"
        required: true
        optional: false
        agent: "architect"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatalf("Failed to write path definition: %v", err)
	}

	// Create BMAD config
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	tests := []struct {
		name             string
		workflowStatuses string
		wantPhase        int
		wantPhaseName    string
		wantNextWF       *string
		wantNextAgent    *string
	}{
		{
			name: "all phase 1 complete, next is phase 2",
			workflowStatuses: `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: "_bmad-output/brainstorm.md"
  product-brief: "_bmad-output/product-brief.md"
  prd: required
  create-architecture: required
`,
			wantPhase:     2,
			wantPhaseName: "Planning",
			wantNextWF:    strPtr("prd"),
			wantNextAgent: strPtr("pm"),
		},
		{
			name: "nothing complete, start at phase 1",
			workflowStatuses: `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: optional
  product-brief: required
  prd: required
  create-architecture: required
`,
			wantPhase:     1,
			wantPhaseName: "Analysis",
			wantNextWF:    strPtr("product-brief"),
			wantNextAgent: strPtr("analyst"),
		},
		{
			name: "all phases complete",
			workflowStatuses: `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: "_bmad-output/brainstorm.md"
  product-brief: "_bmad-output/product-brief.md"
  prd: "_bmad-output/prd.md"
  create-architecture: "_bmad-output/architecture.md"
`,
			wantPhase:     4, // after last phase
			wantPhaseName: "",
			wantNextWF:    nil,
			wantNextAgent: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Write workflow status
			if err := os.WriteFile(filepath.Join(planningDir, "bmm-workflow-status.yaml"), []byte(tt.workflowStatuses), 0644); err != nil {
				t.Fatalf("Failed to write workflow status: %v", err)
			}

			// Set up services
			configService := NewBMadConfigService()
			if err := configService.LoadConfig(tmpDir); err != nil {
				t.Fatalf("Failed to load config: %v", err)
			}

			pathService := NewWorkflowPathService(configService)
			if err := pathService.LoadPaths(); err != nil {
				t.Fatalf("Failed to load paths: %v", err)
			}

			statusService := NewWorkflowStatusService(configService, pathService)
			if err := statusService.LoadStatus(); err != nil {
				t.Fatalf("LoadStatus() error = %v", err)
			}

			status, err := statusService.GetStatus()
			if err != nil {
				t.Fatalf("GetStatus() error = %v", err)
			}

			if status.CurrentPhase != tt.wantPhase {
				t.Errorf("CurrentPhase = %d, want %d", status.CurrentPhase, tt.wantPhase)
			}

			if status.CurrentPhaseName != tt.wantPhaseName {
				t.Errorf("CurrentPhaseName = %s, want %s", status.CurrentPhaseName, tt.wantPhaseName)
			}

			if !strPtrEqual(status.NextWorkflowID, tt.wantNextWF) {
				t.Errorf("NextWorkflowID = %v, want %v", strPtrVal(status.NextWorkflowID), strPtrVal(tt.wantNextWF))
			}

			if !strPtrEqual(status.NextWorkflowAgent, tt.wantNextAgent) {
				t.Errorf("NextWorkflowAgent = %v, want %v", strPtrVal(status.NextWorkflowAgent), strPtrVal(tt.wantNextAgent))
			}
		})
	}
}

func TestWorkflowStatusService_PhaseCompletion(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "phase-completion-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up directory structure
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")

	for _, dir := range []string{planningDir, implDir, pathsDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create dir %s: %v", dir, err)
		}
	}

	// Create path definition
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
  - phase: 2
    name: "Planning"
    required: true
    optional: false
    workflows:
      - id: "prd"
        required: true
        optional: false
        agent: "pm"
      - id: "ux-design"
        required: true
        optional: false
        agent: "ux-designer"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatalf("Failed to write path definition: %v", err)
	}

	// Create BMAD config
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	// Create workflow status with partial completion
	workflowStatusContent := `generated: "2026-01-27"
project: "test-project"
project_type: "software"
selected_track: "bmad-method"
field_type: "greenfield"
workflow_path: "method-greenfield.yaml"

workflow_status:
  brainstorm-project: "_bmad-output/brainstorm.md"
  prd: "_bmad-output/prd.md"
  ux-design: required
`
	if err := os.WriteFile(filepath.Join(planningDir, "bmm-workflow-status.yaml"), []byte(workflowStatusContent), 0644); err != nil {
		t.Fatalf("Failed to write workflow status: %v", err)
	}

	// Set up services
	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	pathService := NewWorkflowPathService(configService)
	if err := pathService.LoadPaths(); err != nil {
		t.Fatalf("Failed to load paths: %v", err)
	}

	statusService := NewWorkflowStatusService(configService, pathService)
	if err := statusService.LoadStatus(); err != nil {
		t.Fatalf("LoadStatus() error = %v", err)
	}

	status, err := statusService.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus() error = %v", err)
	}

	// Verify phase completion
	if len(status.PhaseCompletion) != 2 {
		t.Fatalf("Expected 2 phases, got %d", len(status.PhaseCompletion))
	}

	// Phase 1: Analysis - 1 optional workflow, complete
	phase1 := status.PhaseCompletion[0]
	if phase1.PhaseNum != 1 {
		t.Errorf("Phase 1 num = %d, want 1", phase1.PhaseNum)
	}
	if phase1.Name != "Analysis" {
		t.Errorf("Phase 1 name = %s, want Analysis", phase1.Name)
	}
	if phase1.TotalRequired != 0 {
		t.Errorf("Phase 1 TotalRequired = %d, want 0 (optional phase)", phase1.TotalRequired)
	}

	// Phase 2: Planning - 2 required workflows, 1 complete
	phase2 := status.PhaseCompletion[1]
	if phase2.PhaseNum != 2 {
		t.Errorf("Phase 2 num = %d, want 2", phase2.PhaseNum)
	}
	if phase2.Name != "Planning" {
		t.Errorf("Phase 2 name = %s, want Planning", phase2.Name)
	}
	if phase2.TotalRequired != 2 {
		t.Errorf("Phase 2 TotalRequired = %d, want 2", phase2.TotalRequired)
	}
	if phase2.CompletedCount != 1 {
		t.Errorf("Phase 2 CompletedCount = %d, want 1", phase2.CompletedCount)
	}
	if phase2.PercentComplete != 50 {
		t.Errorf("Phase 2 PercentComplete = %d, want 50", phase2.PercentComplete)
	}
}

func TestWorkflowStatusService_MissingStatusFile(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "missing-status-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up directory structure WITHOUT status files
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")

	for _, dir := range []string{planningDir, implDir, pathsDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create dir %s: %v", dir, err)
		}
	}

	// Create path definition
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
        required: true
        optional: false
        agent: "analyst"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatalf("Failed to write path definition: %v", err)
	}

	// Create BMAD config
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	// Set up services
	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	pathService := NewWorkflowPathService(configService)
	if err := pathService.LoadPaths(); err != nil {
		t.Fatalf("Failed to load paths: %v", err)
	}

	statusService := NewWorkflowStatusService(configService, pathService)
	// LoadStatus should not error when files don't exist
	if err := statusService.LoadStatus(); err != nil {
		t.Fatalf("LoadStatus() error = %v, want nil (graceful handling)", err)
	}

	status, err := statusService.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus() error = %v", err)
	}

	// Should return default state
	if status.CurrentPhase != 1 {
		t.Errorf("CurrentPhase = %d, want 1 (default)", status.CurrentPhase)
	}
	if status.CurrentPhaseName != "Analysis" {
		t.Errorf("CurrentPhaseName = %s, want Analysis", status.CurrentPhaseName)
	}

	// All workflows should be not_started
	for wfID, wfStatus := range status.WorkflowStatuses {
		if wfStatus.Status != types.StatusNotStarted {
			t.Errorf("Workflow %s status = %s, want not_started", wfID, wfStatus.Status)
		}
		if wfStatus.IsComplete {
			t.Errorf("Workflow %s IsComplete = true, want false", wfID)
		}
	}

	// Story statuses should be empty/nil when sprint-status doesn't exist
	if len(status.StoryStatuses) != 0 {
		t.Errorf("StoryStatuses should be empty when sprint-status.yaml doesn't exist, got %d entries", len(status.StoryStatuses))
	}
}

func TestWorkflowStatusService_InvalidYAML(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "invalid-yaml-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Set up directory structure
	planningDir := filepath.Join(tmpDir, "_bmad-output", "planning-artifacts")
	implDir := filepath.Join(tmpDir, "_bmad-output", "implementation-artifacts")
	bmadDir := filepath.Join(tmpDir, "_bmad", "bmm")
	pathsDir := filepath.Join(bmadDir, "workflows", "workflow-status", "paths")

	for _, dir := range []string{planningDir, implDir, pathsDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create dir %s: %v", dir, err)
		}
	}

	// Create path definition
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
        required: true
        optional: false
        agent: "analyst"
`
	if err := os.WriteFile(filepath.Join(pathsDir, "method-greenfield.yaml"), []byte(pathDefContent), 0644); err != nil {
		t.Fatalf("Failed to write path definition: %v", err)
	}

	// Create BMAD config
	configContent := `project_name: test-project
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
`
	if err := os.WriteFile(filepath.Join(bmadDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	// Write invalid YAML
	invalidYAML := `generated: "2026-01-27"
workflow_status:
  - this is not valid: [
`
	if err := os.WriteFile(filepath.Join(planningDir, "bmm-workflow-status.yaml"), []byte(invalidYAML), 0644); err != nil {
		t.Fatalf("Failed to write invalid yaml: %v", err)
	}

	// Set up services
	configService := NewBMadConfigService()
	if err := configService.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	pathService := NewWorkflowPathService(configService)
	if err := pathService.LoadPaths(); err != nil {
		t.Fatalf("Failed to load paths: %v", err)
	}

	statusService := NewWorkflowStatusService(configService, pathService)
	err = statusService.LoadStatus()

	// Should return error for invalid YAML
	if err == nil {
		t.Fatalf("LoadStatus() expected error for invalid YAML, got nil")
	}

	// Verify error type
	statusErr, ok := err.(*WorkflowStatusError)
	if !ok {
		t.Fatalf("Expected WorkflowStatusError, got %T", err)
	}
	if statusErr.Code != ErrCodeInvalidStatusFile {
		t.Errorf("Error code = %s, want %s", statusErr.Code, ErrCodeInvalidStatusFile)
	}
}

// Helper functions
func strPtr(s string) *string {
	return &s
}

func strPtrVal(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func strPtrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}
