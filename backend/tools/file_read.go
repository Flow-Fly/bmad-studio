package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"bmad-studio/backend/types"
)

const maxFileReadSize = 1 << 20 // 1MB

type fileReadInput struct {
	Path string `json:"path"`
}

// NewFileReadTool creates the file_read tool.
func NewFileReadTool(sandbox *Sandbox) *Tool {
	return &Tool{
		Name:        "file_read",
		Description: "Read the contents of a file at the given path. Path can be absolute or relative to the project root.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string","description":"Absolute or relative path to read"}},"required":["path"]}`),
		Category:    types.ToolCategoryFile,
		DangerLevel: types.DangerLevelSafe,
		Execute: func(ctx context.Context, input json.RawMessage) (*ToolResult, error) {
			var params fileReadInput
			if err := json.Unmarshal(input, &params); err != nil {
				return &ToolResult{Output: fmt.Sprintf("invalid input: %v", err), IsError: true}, nil
			}

			resolved, err := sandbox.ValidatePath(params.Path, false)
			if err != nil {
				return nil, err
			}

			info, err := os.Stat(resolved)
			if err != nil {
				if os.IsNotExist(err) {
					return &ToolResult{Output: fmt.Sprintf("file not found: %s", params.Path), IsError: true}, nil
				}
				return &ToolResult{Output: fmt.Sprintf("cannot stat file: %v", err), IsError: true}, nil
			}

			if info.IsDir() {
				entries, err := os.ReadDir(resolved)
				if err != nil {
					return &ToolResult{Output: fmt.Sprintf("cannot read directory: %v", err), IsError: true}, nil
				}
				var listing string
				for _, entry := range entries {
					prefix := "  "
					if entry.IsDir() {
						prefix = "d "
					}
					listing += prefix + entry.Name() + "\n"
				}
				return &ToolResult{Output: listing}, nil
			}

			data, err := os.ReadFile(resolved)
			if err != nil {
				return &ToolResult{Output: fmt.Sprintf("cannot read file: %v", err), IsError: true}, nil
			}

			output := string(data)
			if len(data) > maxFileReadSize {
				output = string(data[:maxFileReadSize]) + fmt.Sprintf("\n\n[truncated: file is %d bytes, showing first %d]", len(data), maxFileReadSize)
			}

			relPath, _ := filepath.Rel(sandbox.ProjectRoot(), resolved)
			return &ToolResult{
				Output:   output,
				Metadata: map[string]interface{}{"path": relPath, "size": len(data)},
			}, nil
		},
	}
}
