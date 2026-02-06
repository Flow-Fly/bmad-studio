package types

// BaseEntity contains common fields for all entities
type BaseEntity struct {
	ID        string    `json:"id"`
	CreatedAt Timestamp `json:"created_at"`
	UpdatedAt Timestamp `json:"updated_at"`
}

// PaginatedResponse is the base type for paginated API responses
type PaginatedResponse struct {
	Total  int `json:"total"`
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

// Project represents a project in the system
type Project struct {
	BaseEntity
	Name        string `json:"name"`
	Path        string `json:"path"`
	Description string `json:"description,omitempty"`
}

// Session represents a conversation session
type Session struct {
	BaseEntity
	ProjectID string `json:"project_id"`
	AgentID   string `json:"agent_id"`
	Title     string `json:"title,omitempty"`
}

// ProviderSettings holds per-provider configuration (keys are NOT stored here)
type ProviderSettings struct {
	Enabled  bool   `json:"enabled"`
	Endpoint string `json:"endpoint,omitempty"`
}

// ProjectEntry represents a project in the recent projects list
type ProjectEntry struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	LastOpened Timestamp `json:"last_opened"`
}

// Settings represents global application settings
type Settings struct {
	DefaultProvider       string                      `json:"default_provider"`
	DefaultModel          string                      `json:"default_model"`
	OllamaEndpoint        string                      `json:"ollama_endpoint"`
	Providers             map[string]ProviderSettings `json:"providers"`
	BraveSearchAPIKey     string                      `json:"braveSearchApiKey,omitempty"`
	RecentProjects        []ProjectEntry              `json:"recent_projects,omitempty"`
	LastActiveProjectPath string                      `json:"last_active_project_path,omitempty"`
}

// Provider represents a configured LLM provider
type Provider struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	BaseURL string `json:"base_url,omitempty"`
	Enabled bool   `json:"enabled"`
}
