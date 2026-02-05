package tools

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"bmad-studio/backend/types"
)

func makeDummyTool(name string, category types.ToolCategory, danger types.DangerLevel) *Tool {
	return &Tool{
		Name:        name,
		Description: "Test tool: " + name,
		InputSchema: json.RawMessage(`{"type":"object"}`),
		Category:    category,
		DangerLevel: danger,
		Execute: func(ctx context.Context, input json.RawMessage) (*ToolResult, error) {
			return &ToolResult{Output: "ok"}, nil
		},
	}
}

func TestRegistry_RegisterAndGet(t *testing.T) {
	r := NewRegistry()
	tool := makeDummyTool("file_read", types.ToolCategoryFile, types.DangerLevelSafe)

	if err := r.RegisterCore(tool); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := r.Get("file_read")
	if got == nil {
		t.Fatal("expected tool to be found")
	}
	if got.Name != "file_read" {
		t.Errorf("expected name %q, got %q", "file_read", got.Name)
	}
}

func TestRegistry_GetUnknown(t *testing.T) {
	r := NewRegistry()

	if r.Get("nonexistent") != nil {
		t.Error("expected nil for unknown tool")
	}
}

func TestRegistry_RegisterDuplicate(t *testing.T) {
	r := NewRegistry()
	tool := makeDummyTool("bash", types.ToolCategoryExec, types.DangerLevelDangerous)

	if err := r.RegisterCore(tool); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	err := r.RegisterCore(tool)
	if err == nil {
		t.Error("expected error for duplicate registration")
	}
}

func TestRegistry_ListForScope_NilReturnsAll(t *testing.T) {
	r := NewRegistry()
	r.RegisterCore(makeDummyTool("file_read", types.ToolCategoryFile, types.DangerLevelSafe))
	r.RegisterCore(makeDummyTool("bash", types.ToolCategoryExec, types.DangerLevelDangerous))
	r.RegisterCore(makeDummyTool("web_search", types.ToolCategorySearch, types.DangerLevelSafe))
	r.RegisterCore(makeDummyTool("file_write", types.ToolCategoryFile, types.DangerLevelDangerous))

	tools := r.ListForScope(nil)
	if len(tools) != 4 {
		t.Errorf("expected 4 tools, got %d", len(tools))
	}
}

func TestRegistry_ListForScope_PartialPermissions(t *testing.T) {
	r := NewRegistry()
	r.RegisterCore(makeDummyTool("file_read", types.ToolCategoryFile, types.DangerLevelSafe))
	r.RegisterCore(makeDummyTool("bash", types.ToolCategoryExec, types.DangerLevelDangerous))
	r.RegisterCore(makeDummyTool("web_search", types.ToolCategorySearch, types.DangerLevelSafe))

	scope := &types.ToolScope{
		Permissions: map[string]types.ToolPermission{
			"file_read":  {Allowed: true},
			"web_search": {Allowed: true},
		},
	}

	tools := r.ListForScope(scope)
	if len(tools) != 2 {
		t.Errorf("expected 2 tools, got %d", len(tools))
	}
}

func TestRegistry_ListForScope_EmptyPermissionsReturnsSafeDefaults(t *testing.T) {
	r := NewRegistry()
	r.RegisterCore(makeDummyTool("file_read", types.ToolCategoryFile, types.DangerLevelSafe))
	r.RegisterCore(makeDummyTool("bash", types.ToolCategoryExec, types.DangerLevelDangerous))
	r.RegisterCore(makeDummyTool("web_search", types.ToolCategorySearch, types.DangerLevelSafe))
	r.RegisterCore(makeDummyTool("file_write", types.ToolCategoryFile, types.DangerLevelDangerous))

	scope := &types.ToolScope{
		Permissions: map[string]types.ToolPermission{},
	}

	tools := r.ListForScope(scope)
	if len(tools) != 2 {
		t.Errorf("expected 2 safe defaults, got %d", len(tools))
	}

	names := map[string]bool{}
	for _, tool := range tools {
		names[tool.Name] = true
	}
	if !names["file_read"] {
		t.Error("expected file_read in safe defaults")
	}
	if !names["web_search"] {
		t.Error("expected web_search in safe defaults")
	}
}

func TestRegistry_ListDefinitionsForScope(t *testing.T) {
	r := NewRegistry()
	r.RegisterCore(makeDummyTool("file_read", types.ToolCategoryFile, types.DangerLevelSafe))
	r.RegisterCore(makeDummyTool("bash", types.ToolCategoryExec, types.DangerLevelDangerous))

	defs := r.ListDefinitionsForScope(nil)
	if len(defs) != 2 {
		t.Fatalf("expected 2 definitions, got %d", len(defs))
	}

	for _, def := range defs {
		if def.Name == "" {
			t.Error("expected non-empty name in definition")
		}
		if def.InputSchema == nil {
			t.Error("expected non-nil input schema")
		}
	}
}

func TestRegistry_RegisterMCP(t *testing.T) {
	r := NewRegistry()
	err := r.RegisterMCP("test-server")
	if err == nil {
		t.Error("expected not-implemented error")
	}
}

func TestRegistry_ConcurrentAccess(t *testing.T) {
	r := NewRegistry()
	var wg sync.WaitGroup

	// Concurrent registrations
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			name := "tool_" + string(rune('a'+n))
			r.RegisterCore(makeDummyTool(name, types.ToolCategoryFile, types.DangerLevelSafe))
		}(i)
	}

	// Concurrent reads
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.ListForScope(nil)
			r.Get("tool_a")
		}()
	}

	wg.Wait()
}

func TestTool_ToDefinition(t *testing.T) {
	tool := &Tool{
		Name:        "test_tool",
		Description: "A test tool",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"x":{"type":"string"}}}`),
	}

	def := tool.ToDefinition()
	if def.Name != "test_tool" {
		t.Errorf("expected name %q, got %q", "test_tool", def.Name)
	}
	if def.Description != "A test tool" {
		t.Errorf("expected description %q, got %q", "A test tool", def.Description)
	}
	if def.InputSchema == nil {
		t.Error("expected non-nil InputSchema")
	}
}
