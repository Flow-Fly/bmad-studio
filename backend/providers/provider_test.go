package providers

import (
	"context"
	"encoding/json"
	"testing"

	"bmad-studio/backend/types"
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
		ID:            "claude-opus-4-5-20251101",
		Name:          "Claude Opus 4.5",
		Provider:      "claude",
		MaxTokens:     32768,
		SupportsTools: true,
	}

	if model.ID != "claude-opus-4-5-20251101" {
		t.Errorf("Expected ID 'claude-opus-4-5-20251101', got %q", model.ID)
	}
	if model.Provider != "claude" {
		t.Errorf("Expected Provider 'claude', got %q", model.Provider)
	}
	if !model.SupportsTools {
		t.Error("Expected SupportsTools to be true")
	}
}

func TestModelSupportsToolsJSONSerialization(t *testing.T) {
	model := Model{
		ID:            "test-model",
		Name:          "Test Model",
		Provider:      "test",
		MaxTokens:     1024,
		SupportsTools: true,
	}

	data, err := json.Marshal(model)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	supportsTools, ok := result["supports_tools"].(bool)
	if !ok {
		t.Fatal("expected supports_tools to be a boolean")
	}
	if !supportsTools {
		t.Error("expected supports_tools to be true")
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

func (m *mockProvider) RequiresAPIKey() bool {
	return true
}

func TestStreamChunkToolFields(t *testing.T) {
	chunk := StreamChunk{
		Type:      ChunkTypeToolCallStart,
		MessageID: "msg-1",
		ToolID:    "toolu_123",
		ToolName:  "file_read",
	}

	data, err := json.Marshal(chunk)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result["toolId"] != "toolu_123" {
		t.Errorf("expected toolId %q, got %v", "toolu_123", result["toolId"])
	}
	if result["toolName"] != "file_read" {
		t.Errorf("expected toolName %q, got %v", "file_read", result["toolName"])
	}
}

func TestStreamChunkToolFieldsOmitted(t *testing.T) {
	// Tool fields should be omitted when empty (backwards compat)
	chunk := StreamChunk{
		Type:      ChunkTypeChunk,
		Content:   "Hello",
		MessageID: "msg-1",
		Index:     0,
	}

	data, err := json.Marshal(chunk)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if _, ok := result["toolId"]; ok {
		t.Error("expected toolId to be omitted when empty")
	}
	if _, ok := result["toolName"]; ok {
		t.Error("expected toolName to be omitted when empty")
	}
}

func TestChunkTypeConstants(t *testing.T) {
	tests := []struct {
		name     string
		constant string
		expected string
	}{
		{"start", ChunkTypeStart, "start"},
		{"chunk", ChunkTypeChunk, "chunk"},
		{"thinking", ChunkTypeThinking, "thinking"},
		{"end", ChunkTypeEnd, "end"},
		{"error", ChunkTypeError, "error"},
		{"tool_call_start", ChunkTypeToolCallStart, "tool_call_start"},
		{"tool_call_delta", ChunkTypeToolCallDelta, "tool_call_delta"},
		{"tool_call_end", ChunkTypeToolCallEnd, "tool_call_end"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, tt.constant)
			}
		})
	}
}

func TestMessageToolFields(t *testing.T) {
	// Tool result message
	msg := Message{
		Role:       "tool",
		Content:    "file contents here",
		ToolCallID: "toolu_123",
		ToolName:   "file_read",
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result["toolCallId"] != "toolu_123" {
		t.Errorf("expected toolCallId %q, got %v", "toolu_123", result["toolCallId"])
	}
	if result["toolName"] != "file_read" {
		t.Errorf("expected toolName %q, got %v", "file_read", result["toolName"])
	}
}

func TestMessageToolCallsField(t *testing.T) {
	msg := Message{
		Role:    "assistant",
		Content: "",
		ToolCalls: []types.ToolCall{
			{ID: "toolu_1", Name: "file_read", Input: json.RawMessage(`{"path":"test.txt"}`)},
			{ID: "toolu_2", Name: "bash", Input: json.RawMessage(`{"command":"ls"}`)},
		},
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var roundTrip Message
	if err := json.Unmarshal(data, &roundTrip); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(roundTrip.ToolCalls) != 2 {
		t.Fatalf("expected 2 tool calls, got %d", len(roundTrip.ToolCalls))
	}
	if roundTrip.ToolCalls[0].Name != "file_read" {
		t.Errorf("expected first tool call name %q, got %q", "file_read", roundTrip.ToolCalls[0].Name)
	}
}

func TestMessageToolFieldsOmitted(t *testing.T) {
	// Plain user message — tool fields should be omitted
	msg := Message{
		Role:    "user",
		Content: "Hello",
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if _, ok := result["toolCallId"]; ok {
		t.Error("expected toolCallId to be omitted")
	}
	if _, ok := result["toolCalls"]; ok {
		t.Error("expected toolCalls to be omitted")
	}
	if _, ok := result["toolName"]; ok {
		t.Error("expected toolName to be omitted")
	}
}

func TestChatRequestToolsField(t *testing.T) {
	req := ChatRequest{
		Messages:  []Message{{Role: "user", Content: "hello"}},
		Model:     "claude-sonnet",
		MaxTokens: 1024,
		Tools: []types.ToolDefinition{
			{
				Name:        "file_read",
				Description: "Read file",
				InputSchema: json.RawMessage(`{"type":"object"}`),
			},
		},
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	tools, ok := result["tools"].([]interface{})
	if !ok {
		t.Fatalf("expected tools to be array, got %T", result["tools"])
	}
	if len(tools) != 1 {
		t.Errorf("expected 1 tool, got %d", len(tools))
	}
}

func TestChatRequestToolsOmitted(t *testing.T) {
	req := ChatRequest{
		Messages:  []Message{{Role: "user", Content: "hello"}},
		Model:     "claude-sonnet",
		MaxTokens: 1024,
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if _, ok := result["tools"]; ok {
		t.Error("expected tools to be omitted when empty")
	}
}
