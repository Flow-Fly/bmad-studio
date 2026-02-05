package types

import "encoding/json"

// ToolCategory classifies tools by their function.
type ToolCategory string

const (
	ToolCategoryFile   ToolCategory = "file"
	ToolCategoryExec   ToolCategory = "exec"
	ToolCategorySearch ToolCategory = "search"
	ToolCategoryMCP    ToolCategory = "mcp"
)

// DangerLevel indicates whether a tool requires user confirmation.
type DangerLevel string

const (
	DangerLevelSafe      DangerLevel = "safe"
	DangerLevelDangerous DangerLevel = "dangerous"
)

// TrustLevel controls how much autonomy tools have during execution.
type TrustLevel string

const (
	TrustLevelSupervised TrustLevel = "supervised"
	TrustLevelGuided     TrustLevel = "guided"
	TrustLevelAutonomous TrustLevel = "autonomous"
)

// ToolScope defines which tools a workflow is allowed to use.
type ToolScope struct {
	Permissions map[string]ToolPermission `json:"permissions"`
}

// ToolPermission controls access for a single tool within a scope.
type ToolPermission struct {
	Allowed bool     `json:"allowed"`
	Paths   []string `json:"paths,omitempty"`
	Timeout string   `json:"timeout,omitempty"`
}

// ToolCall represents a tool invocation requested by an LLM.
type ToolCall struct {
	ID    string          `json:"id"`
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input"`
}

// ToolDefinition describes a tool for provider API requests.
type ToolDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}
