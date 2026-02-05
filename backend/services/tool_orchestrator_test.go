package services

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/tools"
	"bmad-studio/backend/types"
)

// newTestOrchestrator sets up a ToolOrchestrator with a running hub and registered client.
func newTestOrchestrator(t *testing.T, toolList ...*tools.Tool) (*ToolOrchestrator, *websocket.Client) {
	t.Helper()
	hub := websocket.NewHub()
	go hub.Run()
	t.Cleanup(hub.Stop)
	time.Sleep(10 * time.Millisecond)

	client := mockClient(hub)
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	registry := tools.NewRegistry()
	for _, tool := range toolList {
		if err := registry.RegisterCore(tool); err != nil {
			t.Fatalf("failed to register tool: %v", err)
		}
	}

	sandbox := tools.NewSandbox("/tmp/project", "/tmp/central")
	orch := NewToolOrchestrator(registry, sandbox, hub)
	return orch, client
}

func makeTool(name string, danger types.DangerLevel, exec func(ctx context.Context, input json.RawMessage) (*tools.ToolResult, error)) *tools.Tool {
	return &tools.Tool{
		Name:        name,
		Description: name + " tool",
		InputSchema: json.RawMessage(`{"type":"object"}`),
		Category:    types.ToolCategoryFile,
		DangerLevel: danger,
		Execute:     exec,
	}
}

func successExecutor(_ context.Context, _ json.RawMessage) (*tools.ToolResult, error) {
	return &tools.ToolResult{Output: "done", Metadata: map[string]interface{}{"key": "val"}}, nil
}

func errorResultExecutor(_ context.Context, _ json.RawMessage) (*tools.ToolResult, error) {
	return &tools.ToolResult{Output: "file not found", IsError: true}, nil
}

func systemErrorExecutor(_ context.Context, _ json.RawMessage) (*tools.ToolResult, error) {
	return nil, fmt.Errorf("sandbox violation")
}

func TestToolOrchestrator_HandleToolCall_Success(t *testing.T) {
	tool := makeTool("file_read", types.DangerLevelSafe, successExecutor)
	orch, client := newTestOrchestrator(t, tool)

	tc := types.ToolCall{
		ID:    "tool-1",
		Name:  "file_read",
		Input: json.RawMessage(`{"path":"test.txt"}`),
	}

	result, err := orch.HandleToolCall(context.Background(), client, "conv-1", "msg-1", tc, types.TrustLevelGuided)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Output != "done" {
		t.Errorf("expected output 'done', got %q", result.Output)
	}
	if result.IsError {
		t.Error("expected IsError false")
	}

	events := collectEvents(client, 200*time.Millisecond)
	// Should have tool-start and tool-result
	var hasStart, hasResult bool
	for _, e := range events {
		switch e.Type {
		case types.EventTypeChatToolStart:
			hasStart = true
		case types.EventTypeChatToolResult:
			hasResult = true
		}
	}
	if !hasStart {
		t.Error("expected chat:tool-start event")
	}
	if !hasResult {
		t.Error("expected chat:tool-result event")
	}
}

func TestToolOrchestrator_HandleToolCall_UnknownTool(t *testing.T) {
	orch, client := newTestOrchestrator(t)

	tc := types.ToolCall{
		ID:    "tool-1",
		Name:  "nonexistent",
		Input: json.RawMessage(`{}`),
	}

	_, err := orch.HandleToolCall(context.Background(), client, "conv-1", "msg-1", tc, types.TrustLevelGuided)
	if err == nil {
		t.Error("expected error for unknown tool")
	}
}

func TestToolOrchestrator_HandleToolCall_ToolReturnsIsError(t *testing.T) {
	tool := makeTool("file_read", types.DangerLevelSafe, errorResultExecutor)
	orch, client := newTestOrchestrator(t, tool)

	tc := types.ToolCall{
		ID:    "tool-1",
		Name:  "file_read",
		Input: json.RawMessage(`{"path":"missing.txt"}`),
	}

	result, err := orch.HandleToolCall(context.Background(), client, "conv-1", "msg-1", tc, types.TrustLevelGuided)
	if err != nil {
		t.Fatalf("expected no system error, got: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError true")
	}
	if result.Output != "file not found" {
		t.Errorf("expected output 'file not found', got %q", result.Output)
	}

	events := collectEvents(client, 200*time.Millisecond)
	for _, e := range events {
		if e.Type == types.EventTypeChatToolResult {
			payloadBytes, _ := json.Marshal(e.Payload)
			var payload types.ChatToolResultPayload
			json.Unmarshal(payloadBytes, &payload)
			if payload.Status != "error" {
				t.Errorf("expected status 'error', got %q", payload.Status)
			}
			return
		}
	}
	t.Error("expected chat:tool-result event")
}

func TestToolOrchestrator_HandleToolCall_SystemError(t *testing.T) {
	tool := makeTool("file_write", types.DangerLevelDangerous, systemErrorExecutor)
	orch, client := newTestOrchestrator(t, tool)

	tc := types.ToolCall{
		ID:    "tool-1",
		Name:  "file_write",
		Input: json.RawMessage(`{}`),
	}

	_, err := orch.HandleToolCall(context.Background(), client, "conv-1", "msg-1", tc, types.TrustLevelAutonomous)
	if err == nil {
		t.Error("expected system error")
	}
}

func TestToolOrchestrator_NeedsConfirmation(t *testing.T) {
	safeTool := makeTool("file_read", types.DangerLevelSafe, successExecutor)
	dangerousTool := makeTool("bash", types.DangerLevelDangerous, successExecutor)
	orch, _ := newTestOrchestrator(t, safeTool, dangerousTool)

	tests := []struct {
		name       string
		toolName   string
		trustLevel types.TrustLevel
		expected   bool
	}{
		{"supervised + safe", "file_read", types.TrustLevelSupervised, true},
		{"supervised + dangerous", "bash", types.TrustLevelSupervised, true},
		{"guided + safe", "file_read", types.TrustLevelGuided, false},
		{"guided + dangerous", "bash", types.TrustLevelGuided, true},
		{"autonomous + safe", "file_read", types.TrustLevelAutonomous, false},
		{"autonomous + dangerous", "bash", types.TrustLevelAutonomous, false},
		{"guided + unknown tool", "nonexistent", types.TrustLevelGuided, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := orch.NeedsConfirmation(tt.toolName, tt.trustLevel)
			if got != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, got)
			}
		})
	}
}

func TestToolOrchestrator_HandleToolCall_GuidedDangerousNeedsApproval(t *testing.T) {
	tool := makeTool("bash", types.DangerLevelDangerous, successExecutor)
	orch, client := newTestOrchestrator(t, tool)

	tc := types.ToolCall{
		ID:    "tool-approve-1",
		Name:  "bash",
		Input: json.RawMessage(`{"command":"echo hi"}`),
	}

	// Approve asynchronously
	go func() {
		time.Sleep(50 * time.Millisecond)
		orch.HandleApproval("tool-approve-1", true)
	}()

	result, err := orch.HandleToolCall(context.Background(), client, "conv-1", "msg-1", tc, types.TrustLevelGuided)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Output != "done" {
		t.Errorf("expected output 'done', got %q", result.Output)
	}

	events := collectEvents(client, 200*time.Millisecond)
	var hasConfirm bool
	for _, e := range events {
		if e.Type == types.EventTypeChatToolConfirm {
			hasConfirm = true
		}
	}
	if !hasConfirm {
		t.Error("expected chat:tool-confirm event")
	}
}

func TestToolOrchestrator_HandleToolCall_GuidedDangerousDenied(t *testing.T) {
	tool := makeTool("bash", types.DangerLevelDangerous, successExecutor)
	orch, client := newTestOrchestrator(t, tool)

	tc := types.ToolCall{
		ID:    "tool-deny-1",
		Name:  "bash",
		Input: json.RawMessage(`{"command":"rm -rf /"}`),
	}

	// Deny asynchronously
	go func() {
		time.Sleep(50 * time.Millisecond)
		orch.HandleApproval("tool-deny-1", false)
	}()

	result, err := orch.HandleToolCall(context.Background(), client, "conv-1", "msg-1", tc, types.TrustLevelGuided)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError true for denied tool")
	}
	if result.Output != "tool execution denied by user" {
		t.Errorf("unexpected output: %q", result.Output)
	}
}

func TestToolOrchestrator_HandleToolCall_ContextCancellation(t *testing.T) {
	tool := makeTool("bash", types.DangerLevelDangerous, successExecutor)
	orch, client := newTestOrchestrator(t, tool)

	tc := types.ToolCall{
		ID:    "tool-cancel-1",
		Name:  "bash",
		Input: json.RawMessage(`{}`),
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel context while waiting for approval
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	result, err := orch.HandleToolCall(ctx, client, "conv-1", "msg-1", tc, types.TrustLevelSupervised)
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError true for cancelled context")
	}
}

func TestToolOrchestrator_HandleApproval_NoWaiter(t *testing.T) {
	orch, _ := newTestOrchestrator(t)

	// Should not panic when no one is waiting
	orch.HandleApproval("nonexistent-tool", true)
}
