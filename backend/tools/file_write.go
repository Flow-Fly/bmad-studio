package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"bmad-studio/backend/types"
)

type fileWriteInput struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// NewFileWriteTool creates the file_write tool.
func NewFileWriteTool(sandbox *Sandbox) *Tool {
	return &Tool{
		Name:        "file_write",
		Description: "Write content to a file at the given path. Creates parent directories if needed.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string","description":"Absolute or relative path to write"},"content":{"type":"string","description":"Content to write to the file"}},"required":["path","content"]}`),
		Category:    types.ToolCategoryFile,
		DangerLevel: types.DangerLevelDangerous,
		Execute: func(ctx context.Context, input json.RawMessage) (*ToolResult, error) {
			var params fileWriteInput
			if err := json.Unmarshal(input, &params); err != nil {
				return &ToolResult{Output: fmt.Sprintf("invalid input: %v", err), IsError: true}, nil
			}

			resolved, err := sandbox.ValidatePath(params.Path, true)
			if err != nil {
				return nil, err
			}

			dir := filepath.Dir(resolved)
			if err := os.MkdirAll(dir, 0755); err != nil {
				return &ToolResult{Output: fmt.Sprintf("failed to create directories: %v", err), IsError: true}, nil
			}

			if err := os.WriteFile(resolved, []byte(params.Content), 0644); err != nil {
				return &ToolResult{Output: fmt.Sprintf("failed to write file: %v", err), IsError: true}, nil
			}

			relPath, _ := filepath.Rel(sandbox.ProjectRoot(), resolved)
			return &ToolResult{
				Output:   fmt.Sprintf("wrote %d bytes to %s", len(params.Content), relPath),
				Metadata: map[string]interface{}{"path": relPath, "bytes": len(params.Content)},
			}, nil
		},
	}
}
