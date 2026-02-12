package storage

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"bmad-studio/backend/types"
)

// RegistryStore manages the project registry at ~/.bmad-studio/registry.json
type RegistryStore struct {
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
		return types.Registry{Projects: []types.RegistryEntry{}}, nil
	}

	if err != nil {
		// Corruption detected, log warning and return empty registry
		log.Printf("WARNING: Failed to read registry.json: %v (falling back to empty registry)", err)
		return types.Registry{Projects: []types.RegistryEntry{}}, nil
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
