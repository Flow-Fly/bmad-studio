package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig_ValidConfig(t *testing.T) {
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}

	configContent := `project_name: bmad-studio
user_skill_level: intermediate
planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"
implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"
project_knowledge: "{project-root}/docs"
tea_use_mcp_enhancements: false
tea_use_playwright_utils: false
user_name: Flow
communication_language: English
document_output_language: English
output_folder: "{project-root}/_bmad-output"
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	svc := NewBMadConfigService()
	err := svc.LoadConfig(tmpDir)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	config := svc.GetConfig()
	if config == nil {
		t.Fatal("Expected config to be non-nil")
	}

	if config.ProjectName != "bmad-studio" {
		t.Errorf("Expected project_name 'bmad-studio', got '%s'", config.ProjectName)
	}
	if config.UserSkillLevel != "intermediate" {
		t.Errorf("Expected user_skill_level 'intermediate', got '%s'", config.UserSkillLevel)
	}
	if config.UserName != "Flow" {
		t.Errorf("Expected user_name 'Flow', got '%s'", config.UserName)
	}
	if config.CommunicationLanguage != "English" {
		t.Errorf("Expected communication_language 'English', got '%s'", config.CommunicationLanguage)
	}
	if config.DocumentOutputLanguage != "English" {
		t.Errorf("Expected document_output_language 'English', got '%s'", config.DocumentOutputLanguage)
	}
	if config.TeaUseMCPEnhancements != false {
		t.Errorf("Expected tea_use_mcp_enhancements false, got true")
	}
	if config.TeaUsePlaywrightUtils != false {
		t.Errorf("Expected tea_use_playwright_utils false, got true")
	}
}

func TestLoadConfig_ResolvesProjectRootPlaceholders(t *testing.T) {
	tmpDir := t.TempDir()
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

	svc := NewBMadConfigService()
	if err := svc.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	config := svc.GetConfig()

	// All paths should be absolute (no {project-root} placeholders remaining)
	absRoot, _ := filepath.Abs(tmpDir)

	pathTests := []struct {
		name     string
		got      string
		expected string
	}{
		{"PlanningArtifacts", config.PlanningArtifacts, absRoot + "/_bmad-output/planning-artifacts"},
		{"ImplementationArtifacts", config.ImplementationArtifacts, absRoot + "/_bmad-output/implementation-artifacts"},
		{"ProjectKnowledge", config.ProjectKnowledge, absRoot + "/docs"},
		{"OutputFolder", config.OutputFolder, absRoot + "/_bmad-output"},
		{"ProjectRoot", config.ProjectRoot, absRoot},
	}

	for _, tc := range pathTests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.got != tc.expected {
				t.Errorf("Expected '%s', got '%s'", tc.expected, tc.got)
			}
			if !filepath.IsAbs(tc.got) {
				t.Errorf("Expected absolute path, got '%s'", tc.got)
			}
		})
	}
}

func TestLoadConfig_MissingConfigReturnsNotInstalled(t *testing.T) {
	tmpDir := t.TempDir()

	svc := NewBMadConfigService()
	err := svc.LoadConfig(tmpDir)
	if err == nil {
		t.Fatal("Expected error for missing config")
	}

	bmadErr, ok := err.(*BMadConfigError)
	if !ok {
		t.Fatalf("Expected BMadConfigError, got %T", err)
	}
	if bmadErr.Code != ErrCodeBMadNotInstalled {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeBMadNotInstalled, bmadErr.Code)
	}
}

func TestLoadConfig_MalformedYAMLReturnsInvalidConfig(t *testing.T) {
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}

	malformedContent := `{{{invalid yaml: [broken`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(malformedContent), 0644); err != nil {
		t.Fatal(err)
	}

	svc := NewBMadConfigService()
	err := svc.LoadConfig(tmpDir)
	if err == nil {
		t.Fatal("Expected error for malformed YAML")
	}

	bmadErr, ok := err.(*BMadConfigError)
	if !ok {
		t.Fatalf("Expected BMadConfigError, got %T", err)
	}
	if bmadErr.Code != ErrCodeInvalidConfig {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeInvalidConfig, bmadErr.Code)
	}
}

func TestLoadConfig_MultipleProjectRootReferences(t *testing.T) {
	tmpDir := t.TempDir()
	configDir := filepath.Join(tmpDir, "_bmad", "bmm")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Test that multiple {project-root} references in a single field resolve correctly
	configContent := `project_name: test
planning_artifacts: "{project-root}/a/{project-root}/b"
implementation_artifacts: ""
project_knowledge: ""
output_folder: ""
`
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}

	svc := NewBMadConfigService()
	if err := svc.LoadConfig(tmpDir); err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	config := svc.GetConfig()
	absRoot, _ := filepath.Abs(tmpDir)
	expected := absRoot + "/a/" + absRoot + "/b"
	if config.PlanningArtifacts != expected {
		t.Errorf("Expected '%s', got '%s'", expected, config.PlanningArtifacts)
	}
}

func TestGetConfig_ReturnsNilBeforeLoad(t *testing.T) {
	svc := NewBMadConfigService()
	if config := svc.GetConfig(); config != nil {
		t.Error("Expected nil config before LoadConfig is called")
	}
}
