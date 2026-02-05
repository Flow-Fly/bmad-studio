package tools

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestBash_EchoHello(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewBashTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"command":"echo hello"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.IsError {
		t.Fatalf("unexpected tool error: %s", result.Output)
	}
	if strings.TrimSpace(result.Output) != "hello" {
		t.Errorf("expected %q, got %q", "hello", strings.TrimSpace(result.Output))
	}
	if result.Metadata["exitCode"] != 0 {
		t.Errorf("expected exit code 0, got %v", result.Metadata["exitCode"])
	}
}

func TestBash_NonZeroExit(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewBashTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"command":"exit 1"}`))
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError for non-zero exit")
	}
	if result.Metadata["exitCode"] != 1 {
		t.Errorf("expected exit code 1, got %v", result.Metadata["exitCode"])
	}
}

func TestBash_Timeout(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewBashTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"command":"sleep 300","timeout":1}`))
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError for timeout")
	}
	if !strings.Contains(result.Output, "timed out") {
		t.Errorf("expected timeout message, got %q", result.Output)
	}
}

func TestBash_Pwd(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewBashTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"command":"pwd"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.TrimSpace(result.Output) != dir {
		t.Errorf("expected pwd %q, got %q", dir, strings.TrimSpace(result.Output))
	}
}

func TestBash_ContextCancellation(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	tool := NewBashTool(sandbox)
	_, err := tool.Execute(ctx, json.RawMessage(`{"command":"sleep 10"}`))
	if err == nil {
		t.Error("expected error for cancelled context")
	}
}

func TestBash_EmptyCommand(t *testing.T) {
	dir := resolveDir(t, t.TempDir())
	sandbox := NewSandbox(dir, "")

	tool := NewBashTool(sandbox)
	result, err := tool.Execute(context.Background(), json.RawMessage(`{"command":""}`))
	if err != nil {
		t.Fatalf("unexpected system error: %v", err)
	}
	if !result.IsError {
		t.Error("expected IsError for empty command")
	}
}
