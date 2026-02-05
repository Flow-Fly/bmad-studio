package tools

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileRead_ExistingFile(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	os.WriteFile(filepath.Join(dir, "test.txt"), []byte("hello world"), 0644)

	tool := NewFileReadTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"test.txt"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}
	if result.Output != "hello world" {
		t.Errorf("expected %q, got %q", "hello world", result.Output)
	}
}

func TestFileRead_NonExistent(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileReadTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"missing.txt"}`))
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError to be true")
	}
	if !strings.Contains(result.Output, "file not found") {
		t.Errorf("expected 'file not found' message, got %q", result.Output)
	}
}

func TestFileRead_OutsideSandbox(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileReadTool(sandbox)
	_, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"/etc/passwd"}`))
	if err == nil {
		t.Error("expected system error for path outside sandbox")
	}
}

func TestFileRead_RelativePath(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	os.MkdirAll(filepath.Join(dir, "sub"), 0755)
	os.WriteFile(filepath.Join(dir, "sub", "nested.txt"), []byte("nested content"), 0644)

	tool := NewFileReadTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"sub/nested.txt"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Output != "nested content" {
		t.Errorf("expected %q, got %q", "nested content", result.Output)
	}
}

func TestFileRead_LargeFile(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	data := make([]byte, maxFileReadSize+1000)
	for i := range data {
		data[i] = 'x'
	}
	os.WriteFile(filepath.Join(dir, "large.txt"), data, 0644)

	tool := NewFileReadTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"large.txt"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(result.Output, "[truncated") {
		t.Error("expected truncation message for large file")
	}
}

func TestFileRead_BinaryFile(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	os.WriteFile(filepath.Join(dir, "binary.bin"), []byte{0x00, 0x01, 0x02, 0xff}, 0644)

	tool := NewFileReadTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"path":"binary.bin"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Error("binary files should not cause an error")
	}
}

func TestFileRead_InvalidJSON(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewFileReadTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`not json`))
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError for invalid input")
	}
}
