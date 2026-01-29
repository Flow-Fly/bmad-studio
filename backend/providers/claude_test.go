package providers

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// newTestClaudeProvider creates a ClaudeProvider pointing at a test server.
func newTestClaudeProvider(serverURL string) *ClaudeProvider {
	client := anthropic.NewClient(
		option.WithAPIKey("test-key"),
		option.WithBaseURL(serverURL),
	)
	return &ClaudeProvider{client: &client}
}

func TestNewClaudeProvider(t *testing.T) {
	p := NewClaudeProvider("sk-ant-test-key")
	if p == nil {
		t.Fatal("Expected non-nil ClaudeProvider")
	}
	if p.client == nil {
		t.Fatal("Expected non-nil client")
	}
}

// --- ValidateCredentials tests ---

func TestClaudeProvider_ValidateCredentials_Valid(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{
			"id": "msg_test",
			"type": "message",
			"role": "assistant",
			"content": [{"type": "text", "text": "h"}],
			"model": "claude-haiku-4-5-20251001",
			"stop_reason": "end_turn",
			"usage": {"input_tokens": 1, "output_tokens": 1}
		}`)
	}))
	defer server.Close()

	p := newTestClaudeProvider(server.URL)
	err := p.ValidateCredentials(context.Background())
	if err != nil {
		t.Errorf("Expected no error for valid credentials, got %v", err)
	}
}

func TestClaudeProvider_ValidateCredentials_InvalidKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{
			"type": "error",
			"error": {
				"type": "authentication_error",
				"message": "invalid x-api-key"
			}
		}`)
	}))
	defer server.Close()

	p := newTestClaudeProvider(server.URL)
	err := p.ValidateCredentials(context.Background())
	if err == nil {
		t.Fatal("Expected error for invalid credentials")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "auth_error" {
		t.Errorf("Expected error code 'auth_error', got %q", pErr.Code)
	}
}

func TestClaudeProvider_ValidateCredentials_RateLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		fmt.Fprint(w, `{
			"type": "error",
			"error": {
				"type": "rate_limit_error",
				"message": "rate limited"
			}
		}`)
	}))
	defer server.Close()

	p := newTestClaudeProvider(server.URL)
	err := p.ValidateCredentials(context.Background())
	if err == nil {
		t.Fatal("Expected error for rate limit")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "rate_limit" {
		t.Errorf("Expected error code 'rate_limit', got %q", pErr.Code)
	}
}

// --- ListModels tests ---

func TestClaudeProvider_ListModels(t *testing.T) {
	p := NewClaudeProvider("test-key")
	models, err := p.ListModels()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(models) != 3 {
		t.Fatalf("Expected 3 models, got %d", len(models))
	}

	expectedModels := []struct {
		id       string
		name     string
		provider string
	}{
		{"claude-opus-4-5-20251101", "Claude Opus 4.5", "claude"},
		{"claude-sonnet-4-5-20250929", "Claude Sonnet 4.5", "claude"},
		{"claude-haiku-4-5-20251001", "Claude Haiku 4.5", "claude"},
	}

	for i, expected := range expectedModels {
		if models[i].ID != expected.id {
			t.Errorf("Model %d: expected ID %q, got %q", i, expected.id, models[i].ID)
		}
		if models[i].Name != expected.name {
			t.Errorf("Model %d: expected Name %q, got %q", i, expected.name, models[i].Name)
		}
		if models[i].Provider != expected.provider {
			t.Errorf("Model %d: expected Provider %q, got %q", i, expected.provider, models[i].Provider)
		}
		if models[i].MaxTokens <= 0 {
			t.Errorf("Model %d: expected positive MaxTokens, got %d", i, models[i].MaxTokens)
		}
	}
}

func TestClaudeProvider_ListModels_ReturnsCopy(t *testing.T) {
	p := NewClaudeProvider("test-key")
	models1, _ := p.ListModels()
	models2, _ := p.ListModels()

	// Modifying one should not affect the other
	models1[0].Name = "Modified"
	if models2[0].Name == "Modified" {
		t.Error("ListModels should return a copy, not a reference to the internal slice")
	}
}

// --- SendMessage tests ---

func TestClaudeProvider_SendMessage_Streaming(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		events := []string{
			`event: message_start
data: {"type":"message_start","message":{"id":"msg_test123","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250929","stop_reason":null,"usage":{"input_tokens":10,"output_tokens":0}}}`,
			`event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
			`event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}`,
			`event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}`,
			`event: content_block_stop
data: {"type":"content_block_stop","index":0}`,
			`event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":5}}`,
			`event: message_stop
data: {"type":"message_stop"}`,
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming not supported", http.StatusInternalServerError)
			return
		}

		for _, event := range events {
			fmt.Fprintf(w, "%s\n\n", event)
			flusher.Flush()
		}
	}))
	defer server.Close()

	p := newTestClaudeProvider(server.URL)

	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "claude-sonnet-4-5-20250929",
		MaxTokens: 4096,
	})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	var chunks []StreamChunk
	for chunk := range ch {
		chunks = append(chunks, chunk)
	}

	// Expect: start, chunk("Hello"), chunk(" world"), end
	if len(chunks) < 3 {
		t.Fatalf("Expected at least 3 chunks, got %d: %+v", len(chunks), chunks)
	}

	// First chunk should be start
	if chunks[0].Type != "start" {
		t.Errorf("First chunk should be 'start', got %q", chunks[0].Type)
	}
	if chunks[0].MessageID != "msg_test123" {
		t.Errorf("Expected MessageID 'msg_test123', got %q", chunks[0].MessageID)
	}

	// Collect text chunks
	var textContent string
	for _, c := range chunks {
		if c.Type == "chunk" {
			textContent += c.Content
		}
	}
	if textContent != "Hello world" {
		t.Errorf("Expected combined text 'Hello world', got %q", textContent)
	}

	// Last meaningful chunk should be end with usage
	var endChunk *StreamChunk
	for i := len(chunks) - 1; i >= 0; i-- {
		if chunks[i].Type == "end" {
			endChunk = &chunks[i]
			break
		}
	}
	if endChunk == nil {
		t.Fatal("Expected an 'end' chunk")
	}
	if endChunk.Usage == nil {
		t.Fatal("End chunk should have usage stats")
	}
	if endChunk.Usage.InputTokens != 10 {
		t.Errorf("Expected 10 input tokens, got %d", endChunk.Usage.InputTokens)
	}
}

func TestClaudeProvider_SendMessage_InvalidRole(t *testing.T) {
	p := NewClaudeProvider("test-key")

	_, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "system", Content: "test"}},
		Model:     "claude-sonnet-4-5-20250929",
		MaxTokens: 4096,
	})

	if err == nil {
		t.Fatal("Expected error for invalid role")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "invalid_role" {
		t.Errorf("Expected error code 'invalid_role', got %q", pErr.Code)
	}
}

func TestClaudeProvider_SendMessage_WithSystemPrompt(t *testing.T) {
	var receivedBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, r.ContentLength)
		r.Body.Read(buf)
		receivedBody = string(buf)

		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `event: message_start
data: {"type":"message_start","message":{"id":"msg_sys","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250929","stop_reason":null,"usage":{"input_tokens":5,"output_tokens":0}}}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":1}}

event: message_stop
data: {"type":"message_stop"}

`)
	}))
	defer server.Close()

	p := newTestClaudeProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:     []Message{{Role: "user", Content: "Hello"}},
		Model:        "claude-sonnet-4-5-20250929",
		MaxTokens:    100,
		SystemPrompt: "You are a helpful assistant.",
	})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Drain channel
	for range ch {
	}

	// Verify system prompt was sent
	if !strings.Contains(receivedBody, "You are a helpful assistant.") {
		t.Error("System prompt should be included in the request body")
	}
}

func TestClaudeProvider_SendMessage_StreamError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		flusher, _ := w.(http.Flusher)
		fmt.Fprint(w, `event: message_start
data: {"type":"message_start","message":{"id":"msg_err","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250929","stop_reason":null,"usage":{"input_tokens":5,"output_tokens":0}}}

`)
		flusher.Flush()

		// Close connection abruptly to simulate stream error
	}))
	defer server.Close()

	p := newTestClaudeProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "claude-sonnet-4-5-20250929",
		MaxTokens: 100,
	})
	if err != nil {
		t.Fatalf("Expected no initial error, got %v", err)
	}

	// Drain and check for error chunk or start chunk
	var hasStart bool
	for chunk := range ch {
		if chunk.Type == "start" {
			hasStart = true
		}
	}

	if !hasStart {
		t.Error("Expected at least a 'start' chunk before stream ended")
	}
}

// --- NFR6: API key security tests ---

func TestClaudeProvider_ValidateCredentials_NoKeyInError(t *testing.T) {
	apiKey := "sk-ant-super-secret-key-12345"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{
			"type": "error",
			"error": {
				"type": "authentication_error",
				"message": "invalid x-api-key"
			}
		}`)
	}))
	defer server.Close()

	client := anthropic.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL(server.URL),
	)
	p := &ClaudeProvider{client: &client}

	err := p.ValidateCredentials(context.Background())
	if err == nil {
		t.Fatal("Expected error")
	}

	// Verify the API key is not in the error message
	errMsg := err.Error()
	if strings.Contains(errMsg, apiKey) {
		t.Errorf("Error message should not contain API key. Got: %q", errMsg)
	}
	if strings.Contains(errMsg, "sk-ant") {
		t.Errorf("Error message should not contain any API key prefix. Got: %q", errMsg)
	}
}

func TestMapProviderError_AllStatusCodes(t *testing.T) {
	tests := []struct {
		name         string
		statusCode   int
		expectedCode string
	}{
		{"unauthorized", 401, "auth_error"},
		{"rate limit", 429, "rate_limit"},
		{"overloaded", 529, "overloaded"},
		{"bad request", 400, "invalid_request"},
		{"server error", 500, "provider_error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.statusCode)
				fmt.Fprintf(w, `{"type":"error","error":{"type":"test_error","message":"test"}}`)
			}))
			defer server.Close()

			p := newTestClaudeProvider(server.URL)
			err := p.ValidateCredentials(context.Background())
			if err == nil {
				t.Fatal("Expected error")
			}

			pErr, ok := err.(*ProviderError)
			if !ok {
				t.Fatalf("Expected *ProviderError, got %T", err)
			}
			if pErr.Code != tt.expectedCode {
				t.Errorf("Expected code %q, got %q", tt.expectedCode, pErr.Code)
			}
		})
	}
}
