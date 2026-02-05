package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNewOllamaProvider(t *testing.T) {
	tests := []struct {
		name        string
		endpoint    string
		expectedURL string
	}{
		{"explicit endpoint", "http://localhost:11434", "http://localhost:11434"},
		{"empty defaults to localhost", "", "http://localhost:11434"},
		{"custom endpoint", "http://192.168.1.100:8080", "http://192.168.1.100:8080"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewOllamaProvider(tt.endpoint)
			if p == nil {
				t.Fatal("Expected non-nil OllamaProvider")
			}
			if p.baseURL != tt.expectedURL {
				t.Errorf("Expected baseURL %q, got %q", tt.expectedURL, p.baseURL)
			}
			if p.httpClient == nil {
				t.Fatal("Expected non-nil httpClient")
			}
		})
	}
}

func TestOllamaProvider_ValidateCredentials_Reachable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tags" {
			t.Errorf("Expected path /api/tags, got %s", r.URL.Path)
		}
		if r.Method != "GET" {
			t.Errorf("Expected GET method, got %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"models":[]}`)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	err := p.ValidateCredentials(context.Background())
	if err != nil {
		t.Errorf("Expected no error for reachable Ollama, got %v", err)
	}
}

func TestOllamaProvider_ValidateCredentials_Unreachable(t *testing.T) {
	// Use a port that is not listening
	p := NewOllamaProvider("http://127.0.0.1:1")
	err := p.ValidateCredentials(context.Background())
	if err == nil {
		t.Fatal("Expected error for unreachable Ollama")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "connection_error" {
		t.Errorf("Expected error code 'connection_error', got %q", pErr.Code)
	}
	if !strings.Contains(pErr.UserMessage, "Ollama") {
		t.Errorf("UserMessage should mention Ollama, got %q", pErr.UserMessage)
	}
}

func TestOllamaProvider_ValidateCredentials_Timeout(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// Use a server that delays response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	// Small delay to ensure context expires
	time.Sleep(5 * time.Millisecond)
	err := p.ValidateCredentials(ctx)
	if err == nil {
		t.Fatal("Expected error for timeout")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	// Context cancellation or timeout should produce a connection error
	if pErr.Code != "connection_error" && pErr.Code != "timeout" {
		t.Errorf("Expected error code 'connection_error' or 'timeout', got %q", pErr.Code)
	}
}

func TestOllamaProvider_ValidateCredentials_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	err := p.ValidateCredentials(context.Background())
	if err == nil {
		t.Fatal("Expected error for server error")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "provider_error" {
		t.Errorf("Expected error code 'provider_error', got %q", pErr.Code)
	}
}

func TestOllamaProvider_ListModels(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/tags" {
			t.Errorf("Expected path /api/tags, got %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{
			"models": [
				{
					"name": "llama3.2:latest",
					"model": "llama3.2:latest",
					"modified_at": "2026-01-20T10:00:00Z",
					"size": 4700000000
				},
				{
					"name": "codellama:7b",
					"model": "codellama:7b",
					"modified_at": "2026-01-18T10:00:00Z",
					"size": 3800000000
				}
			]
		}`)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	models, err := p.ListModels()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if len(models) != 2 {
		t.Fatalf("Expected 2 models, got %d", len(models))
	}

	// First model (llama3.2 supports tools)
	if models[0].ID != "llama3.2:latest" {
		t.Errorf("Model 0: expected ID 'llama3.2:latest', got %q", models[0].ID)
	}
	if models[0].Name != "llama3.2:latest" {
		t.Errorf("Model 0: expected Name 'llama3.2:latest', got %q", models[0].Name)
	}
	if models[0].Provider != "ollama" {
		t.Errorf("Model 0: expected Provider 'ollama', got %q", models[0].Provider)
	}
	if models[0].MaxTokens != 0 {
		t.Errorf("Model 0: expected MaxTokens 0, got %d", models[0].MaxTokens)
	}
	if !models[0].SupportsTools {
		t.Error("Model 0 (llama3.2): expected SupportsTools true")
	}

	// Second model (codellama does not support tools)
	if models[1].ID != "codellama:7b" {
		t.Errorf("Model 1: expected ID 'codellama:7b', got %q", models[1].ID)
	}
	if models[1].SupportsTools {
		t.Error("Model 1 (codellama): expected SupportsTools false")
	}
}

func TestOllamaSupportsTools(t *testing.T) {
	tests := []struct {
		modelName string
		expected  bool
	}{
		{"llama3.1:latest", true},
		{"llama3.1:70b", true},
		{"llama3.2:latest", true},
		{"llama3.3:70b", true},
		{"mistral:latest", true},
		{"mistral:7b-instruct", true},
		{"qwen2.5:latest", true},
		{"qwen2.5:32b", true},
		{"qwen3:latest", true},
		{"granite3:8b", true},
		{"codellama:7b", false},
		{"llama2:latest", false},
		{"phi:latest", false},
		{"gemma:7b", false},
		{"deepseek-coder:6.7b", false},
	}

	for _, tt := range tests {
		t.Run(tt.modelName, func(t *testing.T) {
			got := ollamaSupportsTools(tt.modelName)
			if got != tt.expected {
				t.Errorf("ollamaSupportsTools(%q) = %v, want %v", tt.modelName, got, tt.expected)
			}
		})
	}
}

func TestOllamaProvider_ListModels_Empty(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"models":[]}`)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	models, err := p.ListModels()
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(models) != 0 {
		t.Errorf("Expected 0 models, got %d", len(models))
	}
}

func TestOllamaProvider_ListModels_Error(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	_, err := p.ListModels()
	if err == nil {
		t.Fatal("Expected error for server error")
	}
}

func TestOllamaProvider_ListModels_Unreachable(t *testing.T) {
	p := NewOllamaProvider("http://127.0.0.1:1")
	_, err := p.ListModels()
	if err == nil {
		t.Fatal("Expected error for unreachable server")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "connection_error" {
		t.Errorf("Expected error code 'connection_error', got %q", pErr.Code)
	}
}

func TestOllamaProvider_ListModels_MalformedJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `this is not valid json`)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	_, err := p.ListModels()
	if err == nil {
		t.Fatal("Expected error for malformed JSON response")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("Expected *ProviderError, got %T", err)
	}
	if pErr.Code != "provider_error" {
		t.Errorf("Expected error code 'provider_error', got %q", pErr.Code)
	}
}

func TestOllamaProvider_SendMessage_Streaming(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/chat" {
			t.Errorf("Expected path /api/chat, got %s", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("Expected POST method, got %s", r.Method)
		}

		w.Header().Set("Content-Type", "application/x-ndjson")
		w.WriteHeader(http.StatusOK)

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming not supported", http.StatusInternalServerError)
			return
		}

		lines := []string{
			`{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":"Hello"},"done":false}`,
			`{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":" world"},"done":false}`,
			`{"model":"llama3.2","created_at":"2026-01-29T10:00:01Z","message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":10,"eval_count":5}`,
		}

		for _, line := range lines {
			fmt.Fprintln(w, line)
			flusher.Flush()
		}
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "llama3.2",
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
	if chunks[0].MessageID == "" {
		t.Error("Start chunk should have a MessageID")
	}
	if !strings.HasPrefix(chunks[0].MessageID, "ollama_") {
		t.Errorf("MessageID should start with 'ollama_', got %q", chunks[0].MessageID)
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

	// Verify chunk indices are sequential
	expectedIndex := 0
	for _, c := range chunks {
		if c.Type == "chunk" {
			if c.Index != expectedIndex {
				t.Errorf("Expected chunk index %d, got %d", expectedIndex, c.Index)
			}
			expectedIndex++
		}
	}

	// Last chunk should be end with usage
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

func TestOllamaProvider_SendMessage_InvalidRole(t *testing.T) {
	p := NewOllamaProvider("http://localhost:11434")

	_, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "function", Content: "test"}},
		Model:     "llama3.2",
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

func TestOllamaProvider_SendMessage_SystemPrompt(t *testing.T) {
	var receivedBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf, _ := io.ReadAll(r.Body)
		receivedBody = string(buf)

		w.Header().Set("Content-Type", "application/x-ndjson")
		w.WriteHeader(http.StatusOK)

		fmt.Fprintln(w, `{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":"Hi"},"done":false}`)
		fmt.Fprintln(w, `{"model":"llama3.2","created_at":"2026-01-29T10:00:01Z","message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":5,"eval_count":1}`)

		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:     []Message{{Role: "user", Content: "Hello"}},
		Model:        "llama3.2",
		MaxTokens:    100,
		SystemPrompt: "You are a helpful assistant.",
	})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Drain channel
	for range ch {
	}

	// Verify system message comes first in the messages array
	var body struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal([]byte(receivedBody), &body); err != nil {
		t.Fatalf("Failed to parse request body: %v", err)
	}
	if len(body.Messages) < 2 {
		t.Fatalf("Expected at least 2 messages, got %d", len(body.Messages))
	}
	if body.Messages[0].Role != "system" {
		t.Errorf("First message should be system, got %q", body.Messages[0].Role)
	}
	if body.Messages[0].Content != "You are a helpful assistant." {
		t.Errorf("System message content mismatch: %q", body.Messages[0].Content)
	}
}

func TestOllamaProvider_SendMessage_StreamError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprint(w, `{"error":"model 'nonexistent' not found"}`)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "nonexistent",
		MaxTokens: 100,
	})

	// For HTTP-level errors, we may get error on initial call or via channel
	if err != nil {
		pErr, ok := err.(*ProviderError)
		if !ok {
			t.Fatalf("Expected *ProviderError, got %T", err)
		}
		if pErr.Code != "model_not_found" {
			t.Errorf("Expected error code 'model_not_found', got %q", pErr.Code)
		}
		return
	}

	// If error comes through channel
	var hasError bool
	for chunk := range ch {
		if chunk.Type == "error" {
			hasError = true
		}
	}
	if !hasError {
		t.Error("Expected an error chunk for model not found")
	}
}

func TestOllamaProvider_SendMessage_ContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-ndjson")
		w.WriteHeader(http.StatusOK)

		flusher, _ := w.(http.Flusher)

		// Send many chunks slowly
		for i := 0; i < 100; i++ {
			fmt.Fprintln(w, `{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":"word "},"done":false}`)
			flusher.Flush()
			time.Sleep(10 * time.Millisecond)
		}

		fmt.Fprintln(w, `{"model":"llama3.2","created_at":"2026-01-29T10:00:01Z","message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":10,"eval_count":100}`)
		flusher.Flush()
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	p := NewOllamaProvider(server.URL)
	ch, err := p.SendMessage(ctx, ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "llama3.2",
		MaxTokens: 4096,
	})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Read start chunk
	chunk, ok := <-ch
	if !ok {
		t.Fatal("Channel closed before start chunk")
	}
	if chunk.Type != "start" {
		t.Errorf("Expected start chunk, got %q", chunk.Type)
	}

	// Cancel context
	cancel()

	// Channel should close within reasonable time
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

func TestOllamaProvider_SendMessage_RequestFormat(t *testing.T) {
	var receivedBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf, _ := io.ReadAll(r.Body)
		receivedBody = string(buf)

		w.Header().Set("Content-Type", "application/x-ndjson")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"model":"llama3.2","created_at":"2026-01-29T10:00:00Z","message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":1,"eval_count":0}`)
	}))
	defer server.Close()

	p := NewOllamaProvider(server.URL)
	ch, err := p.SendMessage(context.Background(), ChatRequest{
		Messages:  []Message{{Role: "user", Content: "Hello"}},
		Model:     "llama3.2",
		MaxTokens: 4096,
	})
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Drain channel
	for range ch {
	}

	// Verify request format
	if !strings.Contains(receivedBody, `"model":"llama3.2"`) {
		t.Error("Request should contain model field")
	}
	if !strings.Contains(receivedBody, `"stream":true`) {
		t.Error("Request should have stream:true")
	}
	if !strings.Contains(receivedBody, `"role":"user"`) {
		t.Error("Request should contain user message")
	}
}

func TestOllamaProvider_ErrorMapping(t *testing.T) {
	tests := []struct {
		name         string
		statusCode   int
		expectedCode string
	}{
		{"not found", 404, "model_not_found"},
		{"bad request", 400, "invalid_request"},
		{"server error", 500, "provider_error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				fmt.Fprint(w, `{"error":"test error"}`)
			}))
			defer server.Close()

			p := NewOllamaProvider(server.URL)
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

func TestOllamaProvider_ErrorsNoSensitiveInfo(t *testing.T) {
	endpointURL := "http://internal-server.local:11434"
	p := NewOllamaProvider(endpointURL)
	err := p.ValidateCredentials(context.Background())
	if err == nil {
		t.Fatal("Expected error")
	}

	// The user-facing error message should not expose the endpoint URL
	errMsg := err.Error()
	if strings.Contains(errMsg, "internal-server.local") {
		t.Errorf("Error message should not expose internal endpoint URL. Got: %q", errMsg)
	}
}
