package services

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"bmad-studio/backend/types"

	"gopkg.in/yaml.v3"
)

// BMadConfigError represents a structured error from the BMAD config service
type BMadConfigError struct {
	Code    string
	Message string
}

func (e *BMadConfigError) Error() string {
	return e.Message
}

const (
	ErrCodeBMadNotInstalled = "bmad_not_installed"
	ErrCodeInvalidConfig    = "invalid_config"
)

// BMadConfigService manages loading and accessing BMAD configuration
type BMadConfigService struct {
	mu     sync.RWMutex
	config *types.BMadConfig
}

// NewBMadConfigService creates a new BMadConfigService instance
func NewBMadConfigService() *BMadConfigService {
	return &BMadConfigService{}
}

// LoadConfig reads and parses the BMAD config.yaml from the given project root
func (s *BMadConfigService) LoadConfig(projectRoot string) error {
	absRoot, err := filepath.Abs(projectRoot)
	if err != nil {
		return &BMadConfigError{
			Code:    ErrCodeInvalidConfig,
			Message: fmt.Sprintf("Failed to resolve project root path: %v", err),
		}
	}

	configPath := filepath.Join(absRoot, "_bmad", "bmm", "config.yaml")

	data, err := os.ReadFile(configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &BMadConfigError{
				Code:    ErrCodeBMadNotInstalled,
				Message: "BMAD configuration not found at _bmad/bmm/config.yaml. Run 'npx bmad-method install' to set up BMAD.",
			}
		}
		return &BMadConfigError{
			Code:    ErrCodeInvalidConfig,
			Message: fmt.Sprintf("Failed to read config file: %v", err),
		}
	}

	var config types.BMadConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return &BMadConfigError{
			Code:    ErrCodeInvalidConfig,
			Message: fmt.Sprintf("Failed to parse config.yaml: %v", err),
		}
	}

	config.ProjectRoot = absRoot
	resolveVariables(&config, absRoot)

	s.mu.Lock()
	s.config = &config
	s.mu.Unlock()

	return nil
}

// GetConfig returns the parsed BMAD configuration, or nil if not loaded
func (s *BMadConfigService) GetConfig() *types.BMadConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

// resolveVariables replaces {project-root} placeholders in all path fields
func resolveVariables(config *types.BMadConfig, projectRoot string) {
	replace := func(s string) string {
		return strings.ReplaceAll(s, "{project-root}", projectRoot)
	}

	config.PlanningArtifacts = replace(config.PlanningArtifacts)
	config.ImplementationArtifacts = replace(config.ImplementationArtifacts)
	config.ProjectKnowledge = replace(config.ProjectKnowledge)
	config.OutputFolder = replace(config.OutputFolder)
}
