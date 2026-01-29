package providers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

// newTestOpenAIProvider creates an OpenAIProvider pointing at a test server.
func newTestOpenAIProvider(serverURL string) *OpenAIProvider {
	client := openai.NewClient(
		option.WithAPIKey("test-key"),
		option.WithBaseURL(serverURL),
	)
	return &OpenAIProvider{client: &client}
}

func TestNewOpenAIProvider(t *testing.T) {
	p := NewOpenAIProvider("sk-test-key")
	if p == nil {
		t.Fatal("Expected non-nil OpenAIProvider")
	}
	if p.client == nil {
		t.Fatal("Expected non-nil client")
	}
}

// --- ValidateCredentials tests ---

func TestOpenAIProvider_ValidateCredentials_Valid(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{
			"id": "chatcmpl-test",
			"object": "chat.completion",
			"choices": [{"index": 0, "message": {"role": "assistant", "content": "h"}, "finish_reason": "stop"}],
			"model": "gpt-4o-mini",
			"usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}
		}`)
	}))
	defer server.Close()

	p := newTestOpenAIProvider(server.URL)
	err := p.ValidateCredentials(context.Background())
	if err != nil {
		t.Errorf("Expected no error for valid credentials, got %v", err)
	}
}

func TestOpenAIProvider_ValidateCredentials_InvalidKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{
			"error": {
				"message": "Incorrect API key provided: sk-test****key.",
				"type": "invalid_request_error",
				"param": null,
				"code": "invalid_api_key"
			}
		}`)
	}))
	defer server.Close()

	p := newTestOpenAIProvider(server.URL)
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

func TestOpenAIProvider_ValidateCredentials_RateLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		fmt.Fprint(w, `{
			"error": {
				"message": "Rate limit reached",
				"type": "tokens",
				"param": null,
				"code": "rate_limit_exceeded"
			}
		}`)
	}))
	defer server.Close()

	p := newTestOpenAIProvider(server.URL)
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

func TestOpenAIProvider_ListModels(t *testing.T) {
	p := NewOpenAIProvider("test-key")
	models, err := p.ListModels()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(models) != 4 {
		t.Fatalf("Expected 4 models, got %d", len(models))
	}

	expectedModels := []struct {
		id       string
		name     string
		provider string
	}{
		{"gpt-4o", "GPT-4o", "openai"},
		{"gpt-4o-mini", "GPT-4o mini", "openai"},
		{"gpt-4.1", "GPT-4.1", "openai"},
		{"gpt-4.1-mini", "GPT-4.1 mini", "openai"},
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

func TestOpenAIProvider_ListModels_ReturnsCopy(t *testing.T) {
	p := NewOpenAIProvider("test-key")
	models1, _ := p.ListModels()
	models2, _ := p.ListModels()

	// Modifying one should not affect the other
	models1[0].Name = "Modified"
	if models2[0].Name == "Modified" {
		t.Error("ListModels should return a copy, not a reference to the internal slice")
	}
}

// --- SendMessage tests ---

func TestOpenAIProvider_SendMessage_Streaming(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		events := []string{
			`data: {"id":"chatcmpl-test123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}`,
			`data: {"id":"chatcmpl-test123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}`,
			`data: {"id":"chatcmpl-test123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}`,
			`data: {"id":"chatcmpl-test123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
			`data: {"id":"chatcmpl-test123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`,
			`data: [DONE]`,
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

	p := newTestOpenAIProvider(server.URL)

	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "gpt-4o",
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
	if chunks[0].MessageID != "chatcmpl-test123" {
		t.Errorf("Expected MessageID 'chatcmpl-test123', got %q", chunks[0].MessageID)
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
	if endChunk.Usage.OutputTokens != 5 {
		t.Errorf("Expected 5 output tokens, got %d", endChunk.Usage.OutputTokens)
	}
}

func TestOpenAIProvider_SendMessage_InvalidRole(t *testing.T) {
	p := NewOpenAIProvider("test-key")

	_, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "system", Content: "test"}},
		Model:     "gpt-4o",
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

func TestOpenAIProvider_SendMessage_WithSystemPrompt(t *testing.T) {
	var receivedBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf, _ := io.ReadAll(r.Body)
		receivedBody = string(buf)

		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		events := []string{
			`data: {"id":"chatcmpl-sys","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}`,
			`data: {"id":"chatcmpl-sys","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}`,
			`data: [DONE]`,
		}

		flusher, _ := w.(http.Flusher)
		for _, event := range events {
			fmt.Fprintf(w, "%s\n\n", event)
			flusher.Flush()
		}
	}))
	defer server.Close()

	p := newTestOpenAIProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:     []Message{{Role: "user", Content: "Hello"}},
		Model:        "gpt-4o",
		MaxTokens:    100,
		SystemPrompt: "You are a helpful assistant.",
	})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Drain channel
	for range ch {
	}

	if !strings.Contains(receivedBody, "You are a helpful assistant.") {
		t.Error("System prompt should be included in the request body")
	}
	if !strings.Contains(receivedBody, `"max_tokens":100`) {
		t.Errorf("Expected max_tokens=100 in request body, got: %s", receivedBody)
	}
}

func TestOpenAIProvider_SendMessage_StreamError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		flusher, _ := w.(http.Flusher)
		fmt.Fprint(w, `data: {"id":"chatcmpl-err","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

`)
		flusher.Flush()

		// Close connection abruptly to simulate stream error
	}))
	defer server.Close()

	p := newTestOpenAIProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "gpt-4o",
		MaxTokens: 100,
	})
	if err != nil {
		t.Fatalf("Expected no initial error, got %v", err)
	}

	var hasStart, hasErrorOrEnd bool
	for chunk := range ch {
		if chunk.Type == "start" {
			hasStart = true
		}
		if chunk.Type == "error" || chunk.Type == "end" {
			hasErrorOrEnd = true
		}
	}

	if !hasStart {
		t.Error("Expected at least a 'start' chunk before stream ended")
	}
	if !hasErrorOrEnd {
		t.Error("Expected an 'error' or 'end' chunk after stream disconnection")
	}
}

// --- Context cancellation test ---

func TestOpenAIProvider_SendMessage_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)

		flusher, _ := w.(http.Flusher)

		startEvent := `data: {"id":"chatcmpl-cancel","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}`
		deltaEvent := `data: {"id":"chatcmpl-cancel","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"word "},"finish_reason":null}]}`

		fmt.Fprintf(w, "%s\n\n", startEvent)
		flusher.Flush()

		for i := 0; i < 100; i++ {
			fmt.Fprintf(w, "%s\n\n", deltaEvent)
			flusher.Flush()
			time.Sleep(10 * time.Millisecond)
		}

		fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	p := newTestOpenAIProvider(server.URL)
	ch, err := p.SendMessage(ctx, ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "gpt-4o",
		MaxTokens: 4096,
	})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	chunk, ok := <-ch
	if !ok {
		t.Fatal("Channel closed before start chunk")
	}
	if chunk.Type != "start" {
		t.Errorf("Expected start chunk, got %q", chunk.Type)
	}

	cancel()

	// Timeout detects goroutine leak if channel does not close after cancellation.
	timeout := time.After(5 * time.Second)
	for {
		select {
		case _, ok := <-ch:
			if !ok {
				return // Channel closed, goroutine exited cleanly
			}
		case <-timeout:
			t.Fatal("Channel did not close after context cancellation - possible goroutine leak")
		}
	}
}

// --- NFR6: API key security tests ---

func TestOpenAIProvider_ValidateCredentials_NoKeyInError(t *testing.T) {
	apiKey := "sk-super-secret-openai-key-12345"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{
			"error": {
				"message": "Incorrect API key provided: sk-super****12345.",
				"type": "invalid_request_error",
				"param": null,
				"code": "invalid_api_key"
			}
		}`)
	}))
	defer server.Close()

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL(server.URL),
	)
	p := &OpenAIProvider{client: &client}

	err := p.ValidateCredentials(context.Background())
	if err == nil {
		t.Fatal("Expected error")
	}

	// Verify the API key is not in the error message
	errMsg := err.Error()
	if strings.Contains(errMsg, apiKey) {
		t.Errorf("Error message should not contain API key. Got: %q", errMsg)
	}
	if strings.Contains(errMsg, "sk-super") {
		t.Errorf("Error message should not contain any API key prefix. Got: %q", errMsg)
	}
}

// --- Error mapping tests ---

func TestOpenAIProvider_MapProviderError_AllStatusCodes(t *testing.T) {
	tests := []struct {
		name         string
		statusCode   int
		expectedCode string
	}{
		{"unauthorized", 401, "auth_error"},
		{"rate limit", 429, "rate_limit"},
		{"bad request", 400, "invalid_request"},
		{"server error", 500, "provider_error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.statusCode)
				fmt.Fprintf(w, `{"error":{"message":"test","type":"test_error","param":null,"code":"test"}}`)
			}))
			defer server.Close()

			p := newTestOpenAIProvider(server.URL)
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
