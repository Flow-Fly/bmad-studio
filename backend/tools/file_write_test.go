package tools

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileWrite_NewFile(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileWriteTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"new.txt","content":"hello world"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}

	data, _ := os.ReadFile(filepath.Join(dir, "new.txt"))
	if string(data) != "hello world" {
		t.Errorf("expected file content %q, got %q", "hello world", string(data))
	}
}

func TestFileWrite_OverwriteExisting(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	os.WriteFile(filepath.Join(dir, "existing.txt"), []byte("old content"), 0644)

	tool := NewFileWriteTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"existing.txt","content":"new content"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}

	data, _ := os.ReadFile(filepath.Join(dir, "existing.txt"))
	if string(data) != "new content" {
		t.Errorf("expected %q, got %q", "new content", string(data))
	}
}

func TestFileWrite_NestedPath(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileWriteTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"deep/nested/dir/file.txt","content":"deep data"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}

	data, _ := os.ReadFile(filepath.Join(dir, "deep", "nested", "dir", "file.txt"))
	if string(data) != "deep data" {
		t.Errorf("expected %q, got %q", "deep data", string(data))
	}
}

func TestFileWrite_OutsideSandbox(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileWriteTool(sandbox)
	_, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"/tmp/outside.txt","content":"hack"}`))
	if err == nil {
		t.Error("expected system error for path outside sandbox")
	}
}

func TestFileWrite_DotEnv(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileWriteTool(sandbox)
	_, err := tool.Execute(context.Background(), json.RawMessage(`{"path":".env","content":"SECRET=bad"}`))
	if err == nil {
		t.Error("expected system error for .env write")
	}
}

func TestFileWrite_EmptyContent(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileWriteTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"empty.txt","content":""}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}

	data, _ := os.ReadFile(filepath.Join(dir, "empty.txt"))
	if len(data) != 0 {
		t.Errorf("expected empty file, got %d bytes", len(data))
	}
}

func TestFileWrite_ReportsBytes(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileWriteTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"count.txt","content":"12345"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Output, "5 bytes") {
		t.Errorf("expected byte count in output, got %q", result.Output)
	}
}
