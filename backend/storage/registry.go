package storage

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"bmad-studio/backend/types"
)

// RegistryStore manages the project registry at ~/.bmad-studio/registry.json
type RegistryStore struct {
	mu    sync.Mutex
	store *CentralStore
}

// NewRegistryStore creates a RegistryStore that uses the given CentralStore
func NewRegistryStore(store *CentralStore) *RegistryStore {
	return &RegistryStore{store: store}
}

// Load reads the registry from registry.json.
// If the file is corrupt or doesn't exist, returns an empty registry with a warning log.
func (r *RegistryStore) Load() (types.Registry, error) {
	registryPath := filepath.Join(r.store.rootDir, "registry.json")

	var registry types.Registry
	err := ReadJSON(registryPath, &registry)

	if os.IsNotExist(err) {
		// File doesn't exist yet, return empty registry
		return types.NewRegistry(), nil
	}

	if err != nil {
		// Corruption detected, log warning and return empty registry
		log.Printf("WARNING: Failed to read registry.json: %v (falling back to empty registry)", err)
		return types.NewRegistry(), nil
	}

	// Ensure Projects array is never nil
	if registry.Projects == nil {
		registry.Projects = []types.RegistryEntry{}
	}

	return registry, nil
}

// Save writes the registry to registry.json using atomic write.
func (r *RegistryStore) Save(registry types.Registry) error {
	registryPath := filepath.Join(r.store.rootDir, "registry.json")

	if err := WriteJSON(registryPath, registry); err != nil {
		return fmt.Errorf("save registry: %w", err)
	}

	return nil
}

// AddProject adds a new project to the registry.
// Returns error if a project with the same repoPath already exists.
// Thread-safe via mutex.
func (r *RegistryStore) AddProject(entry types.RegistryEntry) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Load current registry
	registry, err := r.Load()
	if err != nil {
		return fmt.Errorf("load registry: %w", err)
	}

	// Check for duplicate repoPath
	for _, existing := range registry.Projects {
		if existing.RepoPath == entry.RepoPath {
			return fmt.Errorf("project already registered: %s", entry.RepoPath)
		}
	}

	// Append new entry
	registry.Projects = append(registry.Projects, entry)

	// Save atomically
	if err := r.Save(registry); err != nil {
		return fmt.Errorf("save registry: %w", err)
	}

	return nil
}

// RemoveProject removes a project from the registry by name.
// Returns error if the project is not found.
// Thread-safe via mutex.
func (r *RegistryStore) RemoveProject(projectName string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Load current registry
	registry, err := r.Load()
	if err != nil {
		return fmt.Errorf("load registry: %w", err)
	}

	// Find and remove the entry
	found := false
	filtered := make([]types.RegistryEntry, 0, len(registry.Projects))
	for _, entry := range registry.Projects {
		if entry.Name == projectName {
			found = true
			continue
		}
		filtered = append(filtered, entry)
	}

	if !found {
		return fmt.Errorf("project not found: %s", projectName)
	}

	registry.Projects = filtered

	// Save atomically
	if err := r.Save(registry); err != nil {
		return fmt.Errorf("save registry: %w", err)
	}

	return nil
}

// FindByRepoPath searches for a project by repository path.
// Returns the entry and true if found, zero value and false otherwise.
func (r *RegistryStore) FindByRepoPath(repoPath string) (*types.RegistryEntry, bool) {
	registry, err := r.Load()
	if err != nil {
		return nil, false
	}

	for _, entry := range registry.Projects {
		if entry.RepoPath == repoPath {
			return &entry, true
		}
	}

	return nil, false
}

// FindByName searches for a project by name.
// Returns the entry and true if found, zero value and false otherwise.
func (r *RegistryStore) FindByName(name string) (*types.RegistryEntry, bool) {
	registry, err := r.Load()
	if err != nil {
		return nil, false
	}

	for _, entry := range registry.Projects {
		if entry.Name == name {
			return &entry, true
		}
	}

	return nil, false
}
