package storage

import (
	"log"
	"os"
	"path/filepath"
	"sync"

	"bmad-studio/backend/types"
)

// ConfigStore handles reading and writing application settings to disk.
type ConfigStore struct {
	mu       sync.RWMutex
	filePath string
}

// NewConfigStore creates a ConfigStore using the given CentralStore's config.json path.
func NewConfigStore(store *CentralStore) *ConfigStore {
	return &ConfigStore{
		filePath: filepath.Join(store.rootDir, "config.json"),
	}
}

// NewConfigStoreWithPath creates a ConfigStore with a custom file path (used for testing).
func NewConfigStoreWithPath(path string) *ConfigStore {
	return &ConfigStore{filePath: path}
}

// DefaultSettings returns the default settings used when no config file exists.
func DefaultSettings() types.Settings {
	defaultWorktree := true
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
		DefaultWorktreeCreation: &defaultWorktree,
		ArtifactStorePath:       "~/.bmad-studio",
	}
}

// Load reads settings from the config file. If the file does not exist,
// it returns default settings without error.
func (cs *ConfigStore) Load() (types.Settings, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	return cs.loadLocked()
}

// loadLocked reads settings without acquiring a lock (caller must hold mu).
func (cs *ConfigStore) loadLocked() (types.Settings, error) {
	var s types.Settings
	err := ReadJSON(cs.filePath, &s)

	if os.IsNotExist(err) {
		return DefaultSettings(), nil
	}

	if err != nil {
		// Corruption detected
		log.Printf("Warning: config file %s is corrupted, using defaults: %v", cs.filePath, err)
		return DefaultSettings(), nil
	}

	// Ensure providers map is initialised
	if s.Providers == nil {
		s.Providers = DefaultSettings().Providers
	}

	return s, nil
}

// Save writes settings to the config file.
func (cs *ConfigStore) Save(s types.Settings) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	return cs.saveLocked(s)
}

// saveLocked writes settings without acquiring a lock (caller must hold mu).
func (cs *ConfigStore) saveLocked(s types.Settings) error {
	return WriteJSON(cs.filePath, s)
}

// Update atomically loads, modifies, and saves settings under a single lock.
func (cs *ConfigStore) Update(fn func(*types.Settings)) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	s, err := cs.loadLocked()
	if err != nil {
		return err
	}

	fn(&s)

	return cs.saveLocked(s)
}
