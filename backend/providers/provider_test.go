package providers

import (
	"context"
	"testing"
)

// TestProviderInterfaceCompliance verifies that the Provider interface
// has the correct method signatures by checking a mock implementation.
func TestProviderInterfaceCompliance(t *testing.T) {
	var _ Provider = &mockProvider{}
}

// TestProviderErrorImplementsError verifies ProviderError satisfies the error interface.
func TestProviderErrorImplementsError(t *testing.T) {
	var err error = &ProviderError{
		Code:        "test_error",
		Message:     "internal detail",
		UserMessage: "Something went wrong",
	}

	if err.Error() != "Something went wrong" {
		t.Errorf("Expected UserMessage as error string, got %q", err.Error())
	}
}

func TestProviderErrorFields(t *testing.T) {
	e := &ProviderError{
		Code:        "auth_error",
		Message:     "API returned 401",
		UserMessage: "Invalid API key",
	}

	if e.Code != "auth_error" {
		t.Errorf("Expected Code 'auth_error', got %q", e.Code)
	}
	if e.Message != "API returned 401" {
		t.Errorf("Expected Message 'API returned 401', got %q", e.Message)
	}
	if e.UserMessage != "Invalid API key" {
		t.Errorf("Expected UserMessage 'Invalid API key', got %q", e.UserMessage)
	}
}

func TestStreamChunkTypes(t *testing.T) {
	chunks := []StreamChunk{
		{Type: "start", MessageID: "msg-1"},
		{Type: "chunk", Content: "Hello", MessageID: "msg-1", Index: 0},
		{Type: "chunk", Content: " world", MessageID: "msg-1", Index: 1},
		{Type: "end", MessageID: "msg-1", Usage: &UsageStats{InputTokens: 10, OutputTokens: 5}},
		{Type: "error", Content: "Something failed", MessageID: "msg-1"},
	}

	expectedTypes := []string{"start", "chunk", "chunk", "end", "error"}
	for i, chunk := range chunks {
		if chunk.Type != expectedTypes[i] {
			t.Errorf("Chunk %d: expected type %q, got %q", i, expectedTypes[i], chunk.Type)
		}
	}

	// Verify usage stats on end chunk
	if chunks[3].Usage == nil {
		t.Fatal("End chunk should have usage stats")
	}
	if chunks[3].Usage.InputTokens != 10 {
		t.Errorf("Expected 10 input tokens, got %d", chunks[3].Usage.InputTokens)
	}
	if chunks[3].Usage.OutputTokens != 5 {
		t.Errorf("Expected 5 output tokens, got %d", chunks[3].Usage.OutputTokens)
	}
}

func TestChatRequestFields(t *testing.T) {
	req := ChatRequest{
		Messages: []Message{
			{Role: "user", Content: "Hello"},
		},
		Model:        "claude-sonnet-4-5-20250929",
		MaxTokens:    4096,
		SystemPrompt: "You are helpful.",
	}

	if len(req.Messages) != 1 {
		t.Errorf("Expected 1 message, got %d", len(req.Messages))
	}
	if req.Model != "claude-sonnet-4-5-20250929" {
		t.Errorf("Expected model 'claude-sonnet-4-5-20250929', got %q", req.Model)
	}
	if req.MaxTokens != 4096 {
		t.Errorf("Expected max_tokens 4096, got %d", req.MaxTokens)
	}
}

func TestModelFields(t *testing.T) {
	model := Model{
		ID:        "claude-opus-4-5-20251101",
		Name:      "Claude Opus 4.5",
		Provider:  "claude",
		MaxTokens: 32768,
	}

	if model.ID != "claude-opus-4-5-20251101" {
		t.Errorf("Expected ID 'claude-opus-4-5-20251101', got %q", model.ID)
	}
	if model.Provider != "claude" {
		t.Errorf("Expected Provider 'claude', got %q", model.Provider)
	}
}

// mockProvider is a test implementation of Provider used for interface compliance.
type mockProvider struct{}

func (m *mockProvider) SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	ch := make(chan StreamChunk, 1)
	close(ch)
	return ch, nil
}

func (m *mockProvider) ValidateCredentials(ctx context.Context) error {
	return nil
}

func (m *mockProvider) ListModels() ([]Model, error) {
	return []Model{}, nil
}
