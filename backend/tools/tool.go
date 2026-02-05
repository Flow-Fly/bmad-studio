package tools

import (
	"context"
	"encoding/json"

	"bmad-studio/backend/types"
)

// Tool represents an executable tool that an LLM agent can invoke.
type Tool struct {
	Name        string
	Description string
	InputSchema json.RawMessage
	Category    types.ToolCategory
	DangerLevel types.DangerLevel
	Execute     func(ctx context.Context, input json.RawMessage) (*ToolResult, error)
}

// ToolResult is the output of a tool execution.
type ToolResult struct {
	Output   string
	Metadata map[string]interface{}
	IsError  bool
}

// ToDefinition converts a Tool to a ToolDefinition for provider requests.
func (t *Tool) ToDefinition() types.ToolDefinition {
	return types.ToolDefinition{
		Name:        t.Name,
		Description: t.Description,
		InputSchema: t.InputSchema,
	}
}
