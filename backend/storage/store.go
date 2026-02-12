package storage

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"bmad-studio/backend/types"
)

// CentralStore manages the ~/.bmad-studio/ directory structure
type CentralStore struct {
	rootDir string
}

// defaultConfigSettings returns the default settings for config.json
func defaultConfigSettings() types.Settings {
	return types.Settings{
		DefaultProvider: "claude",
		DefaultModel:    "claude-sonnet-4-5-20250929",
		OllamaEndpoint:  "http://localhost:11434",
		Providers: map[string]types.ProviderSettings{
			"claude": {Enabled: true},
			"openai": {Enabled: false},
			"ollama": {Enabled: false, Endpoint: "http://localhost:11434"},
			"gemini": {Enabled: false},
		},
	}
}

// syncDir fsyncs a directory to ensure metadata reaches disk (crash-safe directory operations)
func syncDir(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.Sync()
}

// NewCentralStore creates a CentralStore with the default path (~/.bmad-studio/)
func NewCentralStore() (*CentralStore, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("get user home directory: %w", err)
	}

	rootDir := filepath.Join(homeDir, ".bmad-studio")
	return &CentralStore{rootDir: rootDir}, nil
}

// NewCentralStoreWithPath creates a CentralStore with a custom path (for testing)
func NewCentralStoreWithPath(path string) *CentralStore {
	return &CentralStore{rootDir: path}
}

// Init creates the central store directory structure and default files if they don't exist.
// If files already exist, it validates them but does NOT overwrite.
// Corruption is tolerated -- logs warnings and continues with defaults.
func (s *CentralStore) Init() error {
	// Create root directory
	if err := os.MkdirAll(s.rootDir, 0755); err != nil {
		return fmt.Errorf("create root directory: %w", err)
	}

	// Create projects subdirectory
	projectsDir := filepath.Join(s.rootDir, "projects")
	if err := os.MkdirAll(projectsDir, 0755); err != nil {
		return fmt.Errorf("create projects directory: %w", err)
	}
	// Fsync parent directory to ensure directory metadata reaches disk (crash-safe)
	if err := syncDir(s.rootDir); err != nil {
		return fmt.Errorf("fsync root directory: %w", err)
	}

	// Initialize registry.json if it doesn't exist
	registryPath := filepath.Join(s.rootDir, "registry.json")
	if _, err := os.Stat(registryPath); os.IsNotExist(err) {
		// Create empty registry
		defaultRegistry := types.NewRegistry()
		if err := WriteJSON(registryPath, defaultRegistry); err != nil {
			return fmt.Errorf("create default registry: %w", err)
		}
	} else if err == nil {
		// File exists, validate it can be read
		var registry types.Registry
		if err := ReadJSON(registryPath, &registry); err != nil {
			log.Printf("WARNING: Corrupt registry.json detected: %v (continuing with existing file)", err)
		}
	}

	// Initialize config.json if it doesn't exist
	configPath := filepath.Join(s.rootDir, "config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Create default config using ConfigStore defaults
		if err := WriteJSON(configPath, defaultConfigSettings()); err != nil {
			return fmt.Errorf("create default config: %w", err)
		}
	} else if err == nil {
		// File exists, validate it can be read
		var settings types.Settings
		if err := ReadJSON(configPath, &settings); err != nil {
			log.Printf("WARNING: Corrupt config.json detected: %v (continuing with existing file)", err)
		}
	}

	return nil
}

// Validate checks that the central store directory and required files exist.
// Returns error if structure is invalid.
func (s *CentralStore) Validate() error {
	// Check root directory exists
	if _, err := os.Stat(s.rootDir); os.IsNotExist(err) {
		return fmt.Errorf("central store directory does not exist: %s", s.rootDir)
	}

	// Check projects directory exists
	projectsDir := filepath.Join(s.rootDir, "projects")
	if _, err := os.Stat(projectsDir); os.IsNotExist(err) {
		return fmt.Errorf("projects directory does not exist: %s", projectsDir)
	}

	// Check registry.json exists
	registryPath := filepath.Join(s.rootDir, "registry.json")
	if _, err := os.Stat(registryPath); os.IsNotExist(err) {
		return fmt.Errorf("registry.json does not exist: %s", registryPath)
	}

	// Check config.json exists
	configPath := filepath.Join(s.rootDir, "config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return fmt.Errorf("config.json does not exist: %s", configPath)
	}

	return nil
}

// RootDir returns the root directory path of the central store
func (s *CentralStore) RootDir() string {
	return s.rootDir
}
