package types

// Registry represents the central project registry at ~/.bmad-studio/registry.json
type Registry struct {
	Projects []RegistryEntry `json:"projects"`
}

// RegistryEntry represents a single project in the registry
type RegistryEntry struct {
	Name      string `json:"name"`
	RepoPath  string `json:"repoPath"`
	StorePath string `json:"storePath"`
}

// ProjectMeta represents detailed project metadata stored in ~/.bmad-studio/projects/{name}/project.json
type ProjectMeta struct {
	Name      string         `json:"name"`
	RepoPath  string         `json:"repoPath"`
	CreatedAt string         `json:"createdAt"` // ISO 8601 format
	Settings  map[string]any `json:"settings,omitempty"`
}
