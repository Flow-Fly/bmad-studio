package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"time"

	"bmad-studio/backend/types"
)

const (
	defaultBashTimeout = 60 * time.Second
	maxBashOutput      = 100 * 1024 // 100KB
)

type bashInput struct {
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"`
}

// NewBashTool creates the bash tool.
func NewBashTool(sandbox *Sandbox) *Tool {
	return &Tool{
		Name:        "bash",
		Description: "Execute a shell command. The working directory is set to the project root. Environment variables containing secrets are stripped.",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"command":{"type":"string","description":"Shell command to execute"},"timeout":{"type":"integer","description":"Timeout in seconds (default 60)"}},"required":["command"]}`),
		Category:    types.ToolCategoryExec,
		DangerLevel: types.DangerLevelDangerous,
		Execute: func(ctx context.Context, input json.RawMessage) (*ToolResult, error) {
			var params bashInput
			if err := json.Unmarshal(input, &params); err != nil {
				return &ToolResult{Output: fmt.Sprintf("invalid input: %v", err), IsError: true}, nil
			}

			if params.Command == "" {
				return &ToolResult{Output: "command is required", IsError: true}, nil
			}

			timeout := defaultBashTimeout
			if params.Timeout > 0 {
				timeout = time.Duration(params.Timeout) * time.Second
			}

			execCtx, cancel := context.WithTimeout(ctx, timeout)
			defer cancel()

			cmd := exec.CommandContext(execCtx, "sh", "-c", params.Command)
			cmd.Dir = sandbox.ProjectRoot()
			cmd.Env = sandbox.ValidateBashEnv(os.Environ())

			output, err := cmd.CombinedOutput()

			outputStr := string(output)
			if len(output) > maxBashOutput {
				outputStr = string(output[:maxBashOutput]) + fmt.Sprintf("\n\n[truncated: output is %d bytes, showing first %d]", len(output), maxBashOutput)
			}

			if err != nil {
				if execCtx.Err() == context.DeadlineExceeded {
					return &ToolResult{
						Output:   "command timed out after " + timeout.String(),
						IsError:  true,
						Metadata: map[string]interface{}{"timeout": true},
					}, nil
				}

				if ctx.Err() != nil {
					return nil, ctx.Err()
				}

				exitCode := -1
				if exitErr, ok := err.(*exec.ExitError); ok {
					exitCode = exitErr.ExitCode()
				}

				return &ToolResult{
					Output:   outputStr,
					IsError:  true,
					Metadata: map[string]interface{}{"exitCode": exitCode},
				}, nil
			}

			return &ToolResult{
				Output:   outputStr,
				Metadata: map[string]interface{}{"exitCode": 0},
			}, nil
		},
	}
}
