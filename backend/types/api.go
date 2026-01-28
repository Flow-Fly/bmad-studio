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

// Settings represents global application settings
type Settings struct {
	DefaultProvider string `json:"default_provider,omitempty"`
	Theme           string `json:"theme,omitempty"`
}

// Provider represents a configured LLM provider
type Provider struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	BaseURL string `json:"base_url,omitempty"`
	Enabled bool   `json:"enabled"`
}
