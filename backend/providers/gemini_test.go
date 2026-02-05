package providers

import (
	"encoding/json"
	"strings"
	"testing"

	"bmad-studio/backend/types"

	"google.golang.org/genai"
)

func TestNewGeminiProvider(t *testing.T) {
	apiKey := "AIza-test-key-12345"
	p := NewGeminiProvider(apiKey)
	if p == nil {
		t.Fatal("Expected non-nil GeminiProvider")
	}
	if p.apiKey != apiKey {
		t.Errorf("Expected apiKey %q, got %q", apiKey, p.apiKey)
	}
}

func TestGeminiProvider_RequiresAPIKey(t *testing.T) {
	p := NewGeminiProvider("test-key")
	if !p.RequiresAPIKey() {
		t.Error("Expected RequiresAPIKey() to return true for Gemini")
	}
}

// --- Message building tests ---

func TestBuildGeminiMessages_UserMessage(t *testing.T) {
	msgs := []Message{
		{Role: "user", Content: "Hello world"},
	}

	contents, err := buildGeminiMessages(msgs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(contents) != 1 {
		t.Fatalf("expected 1 content, got %d", len(contents))
	}
	if contents[0].Role != "user" {
		t.Errorf("expected role 'user', got %q", contents[0].Role)
	}
	if len(contents[0].Parts) != 1 {
		t.Fatalf("expected 1 part, got %d", len(contents[0].Parts))
	}
	if contents[0].Parts[0].Text != "Hello world" {
		t.Errorf("expected text 'Hello world', got %q", contents[0].Parts[0].Text)
	}
}

func TestBuildGeminiMessages_AssistantMessage(t *testing.T) {
	msgs := []Message{
		{Role: "assistant", Content: "Hello, I'm Claude"},
	}

	contents, err := buildGeminiMessages(msgs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(contents) != 1 {
		t.Fatalf("expected 1 content, got %d", len(contents))
	}
	if contents[0].Role != "model" {
		t.Errorf("expected role 'model', got %q", contents[0].Role)
	}
}

func TestBuildGeminiMessages_AssistantWithToolCall(t *testing.T) {
	msgs := []Message{
		{Role: "user", Content: "Read test.txt"},
		{
			Role:    "assistant",
			Content: "Let me read that file",
			ToolCalls: []types.ToolCall{
				{ID: "tool_1", Name: "file_read", Input: json.RawMessage(`{"path":"test.txt"}`)},
			},
		},
	}

	contents, err := buildGeminiMessages(msgs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(contents) != 2 {
		t.Fatalf("expected 2 contents, got %d", len(contents))
	}

	assistantContent := contents[1]
	if assistantContent.Role != "model" {
		t.Errorf("expected role 'model', got %q", assistantContent.Role)
	}
	if len(assistantContent.Parts) != 2 {
		t.Fatalf("expected 2 parts (text + function call), got %d", len(assistantContent.Parts))
	}

	// Check text part
	if assistantContent.Parts[0].Text != "Let me read that file" {
		t.Errorf("expected text 'Let me read that file', got %q", assistantContent.Parts[0].Text)
	}

	// Check function call part
	fc := assistantContent.Parts[1].FunctionCall
	if fc == nil {
		t.Fatal("expected FunctionCall to be set")
	}
	if fc.Name != "file_read" {
		t.Errorf("expected function name 'file_read', got %q", fc.Name)
	}
}

func TestBuildGeminiMessages_ToolResult(t *testing.T) {
	msgs := []Message{
		{Role: "tool", ToolName: "file_read", Content: `{"result": "file contents"}`},
	}

	contents, err := buildGeminiMessages(msgs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(contents) != 1 {
		t.Fatalf("expected 1 content, got %d", len(contents))
	}

	// Tool results become user messages with FunctionResponse
	if contents[0].Role != "user" {
		t.Errorf("expected role 'user' for tool result, got %q", contents[0].Role)
	}
	if len(contents[0].Parts) != 1 {
		t.Fatalf("expected 1 part, got %d", len(contents[0].Parts))
	}

	fr := contents[0].Parts[0].FunctionResponse
	if fr == nil {
		t.Fatal("expected FunctionResponse to be set")
	}
	if fr.Name != "file_read" {
		t.Errorf("expected function name 'file_read', got %q", fr.Name)
	}
}

func TestBuildGeminiMessages_InvalidRole(t *testing.T) {
	msgs := []Message{
		{Role: "system", Content: "You are helpful"},
	}

	_, err := buildGeminiMessages(msgs)
	if err == nil {
		t.Fatal("expected error for invalid role")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("expected *ProviderError, got %T", err)
	}
	if pErr.Code != "invalid_role" {
		t.Errorf("expected error code 'invalid_role', got %q", pErr.Code)
	}
}

func TestBuildGeminiMessages_ToolResultMissingName(t *testing.T) {
	msgs := []Message{
		{Role: "tool", ToolName: "", Content: `{"result": "data"}`},
	}

	_, err := buildGeminiMessages(msgs)
	if err == nil {
		t.Fatal("expected error for tool result missing name")
	}

	pErr, ok := err.(*ProviderError)
	if !ok {
		t.Fatalf("expected *ProviderError, got %T", err)
	}
	if pErr.Code != "invalid_tool_result" {
		t.Errorf("expected error code 'invalid_tool_result', got %q", pErr.Code)
	}
}

func TestGeminiProvider_ListModels(t *testing.T) {
	p := NewGeminiProvider("test-key")
	models, err := p.ListModels()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(models) < 2 {
		t.Fatalf("expected at least 2 models, got %d", len(models))
	}

	// Verify all models have required fields
	for i, m := range models {
		if m.ID == "" {
			t.Errorf("model %d: expected non-empty ID", i)
		}
		if m.Name == "" {
			t.Errorf("model %d: expected non-empty Name", i)
		}
		if m.Provider != "gemini" {
			t.Errorf("model %d: expected provider 'gemini', got %q", i, m.Provider)
		}
	}
}

func TestGeminiProvider_ListModels_ReturnsCopy(t *testing.T) {
	p := NewGeminiProvider("test-key")
	models1, _ := p.ListModels()
	models2, _ := p.ListModels()

	// Modifying one should not affect the other
	models1[0].Name = "Modified"
	if models2[0].Name == "Modified" {
		t.Error("ListModels should return a copy, not a reference to the internal slice")
	}
}

// --- Tool building tests ---

func TestBuildGeminiTools(t *testing.T) {
	defs := []types.ToolDefinition{
		{
			Name:        "file_read",
			Description: "Read a file from disk",
			InputSchema: json.RawMessage(`{
				"type": "object",
				"properties": {
					"path": {"type": "string", "description": "File path"}
				},
				"required": ["path"]
			}`),
		},
	}

	tools := buildGeminiTools(defs)
	if len(tools) != 1 {
		t.Fatalf("expected 1 tool, got %d", len(tools))
	}
	if len(tools[0].FunctionDeclarations) != 1 {
		t.Fatalf("expected 1 function declaration, got %d", len(tools[0].FunctionDeclarations))
	}

	fd := tools[0].FunctionDeclarations[0]
	if fd.Name != "file_read" {
		t.Errorf("expected name 'file_read', got %q", fd.Name)
	}
	if fd.Description != "Read a file from disk" {
		t.Errorf("expected description 'Read a file from disk', got %q", fd.Description)
	}
	if fd.Parameters == nil {
		t.Fatal("expected Parameters to be set")
	}
}

func TestBuildGeminiTools_MultipleTools(t *testing.T) {
	defs := []types.ToolDefinition{
		{
			Name:        "file_read",
			Description: "Read a file",
			InputSchema: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string"}}}`),
		},
		{
			Name:        "file_write",
			Description: "Write a file",
			InputSchema: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"}}}`),
		},
	}

	tools := buildGeminiTools(defs)
	if len(tools) != 1 {
		t.Fatalf("expected 1 tool container, got %d", len(tools))
	}
	if len(tools[0].FunctionDeclarations) != 2 {
		t.Fatalf("expected 2 function declarations, got %d", len(tools[0].FunctionDeclarations))
	}
}

func TestBuildPropertySchema_Types(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]any
		wantType genai.Type
	}{
		{"string", map[string]any{"type": "string"}, genai.TypeString},
		{"number", map[string]any{"type": "number"}, genai.TypeNumber},
		{"integer", map[string]any{"type": "integer"}, genai.TypeInteger},
		{"boolean", map[string]any{"type": "boolean"}, genai.TypeBoolean},
		{"array", map[string]any{"type": "array", "items": map[string]any{"type": "string"}}, genai.TypeArray},
		{"object", map[string]any{"type": "object"}, genai.TypeObject},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			schema := buildPropertySchema(tt.input)
			if schema.Type != tt.wantType {
				t.Errorf("expected type %v, got %v", tt.wantType, schema.Type)
			}
		})
	}
}

func TestBuildPropertySchema_WithDescription(t *testing.T) {
	input := map[string]any{
		"type":        "string",
		"description": "The file path to read",
	}

	schema := buildPropertySchema(input)
	if schema.Description != "The file path to read" {
		t.Errorf("expected description 'The file path to read', got %q", schema.Description)
	}
}

func TestBuildPropertySchema_WithEnum(t *testing.T) {
	input := map[string]any{
		"type": "string",
		"enum": []any{"read", "write", "append"},
	}

	schema := buildPropertySchema(input)
	if len(schema.Enum) != 3 {
		t.Fatalf("expected 3 enum values, got %d", len(schema.Enum))
	}
	if schema.Enum[0] != "read" {
		t.Errorf("expected first enum 'read', got %q", schema.Enum[0])
	}
}

// --- Error mapping tests ---

func TestMapGeminiProviderError_AuthError(t *testing.T) {
	tests := []struct {
		name string
		err  string
	}{
		{"401 status", "rpc error: code = Unauthenticated desc = 401"},
		{"403 status", "rpc error: code = PermissionDenied desc = 403"},
		{"api key mention", "API key not valid. Please pass a valid API key."},
		{"permission denied", "Permission denied for this API key"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pErr := mapGeminiProviderError(errFromString(tt.err))
			if pErr.Code != "auth_error" {
				t.Errorf("expected code 'auth_error', got %q", pErr.Code)
			}
		})
	}
}

func TestMapGeminiProviderError_RateLimit(t *testing.T) {
	tests := []struct {
		name string
		err  string
	}{
		{"429 status", "rpc error: code = ResourceExhausted desc = 429"},
		{"quota exceeded", "Quota exceeded for this project"},
		{"rate limited", "Rate limit exceeded"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pErr := mapGeminiProviderError(errFromString(tt.err))
			if pErr.Code != "rate_limit" {
				t.Errorf("expected code 'rate_limit', got %q", pErr.Code)
			}
		})
	}
}

func TestMapGeminiProviderError_InvalidRequest(t *testing.T) {
	tests := []struct {
		name string
		err  string
	}{
		{"400 status", "rpc error: code = InvalidArgument desc = 400"},
		{"invalid something", "Invalid model name specified"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pErr := mapGeminiProviderError(errFromString(tt.err))
			if pErr.Code != "invalid_request" {
				t.Errorf("expected code 'invalid_request', got %q", pErr.Code)
			}
		})
	}
}

func TestMapGeminiProviderError_GenericError(t *testing.T) {
	pErr := mapGeminiProviderError(errFromString("some unknown error occurred"))
	if pErr.Code != "provider_error" {
		t.Errorf("expected code 'provider_error', got %q", pErr.Code)
	}
}

func TestMapGeminiProviderError_Nil(t *testing.T) {
	pErr := mapGeminiProviderError(nil)
	if pErr != nil {
		t.Errorf("expected nil for nil error, got %+v", pErr)
	}
}

// --- NFR6: API key security tests ---

func TestSanitizeErrorMessage_RemovesAPIKey(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "API key in message",
			input: "Error with API key AIzaSyDtest123456789abcdef in request",
			want:  "Error with API key [REDACTED] in request",
		},
		{
			name:  "API key at end",
			input: "Invalid key: AIzaSyDtest123456789abcdef",
			want:  "Invalid key: [REDACTED]",
		},
		{
			name:  "no API key",
			input: "Some other error message",
			want:  "Some other error message",
		},
		{
			name:  "partial match not API key",
			input: "Error in AI processing",
			want:  "Error in AI processing",
		},
		{
			name:  "multiple API keys",
			input: "Keys AIzaSyD111 and AIzaSyD222 are invalid",
			want:  "Keys [REDACTED] and [REDACTED] are invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeErrorMessage(tt.input)
			if got != tt.want {
				t.Errorf("sanitizeErrorMessage(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestMapGeminiProviderError_NoKeyInUserMessage(t *testing.T) {
	apiKey := "AIzaSyDsecretkey123456789"
	errMsg := "API key " + apiKey + " is not valid"

	pErr := mapGeminiProviderError(errFromString(errMsg))

	// UserMessage should never contain the API key
	if strings.Contains(pErr.UserMessage, apiKey) {
		t.Errorf("UserMessage should not contain API key. Got: %q", pErr.UserMessage)
	}
	if strings.Contains(pErr.UserMessage, "AIza") {
		t.Errorf("UserMessage should not contain any API key prefix. Got: %q", pErr.UserMessage)
	}
}

func TestMapGeminiProviderError_SanitizedInternalMessage(t *testing.T) {
	apiKey := "AIzaSyDsecretkey123456789"
	errMsg := "Error: invalid " + apiKey + " provided"

	pErr := mapGeminiProviderError(errFromString(errMsg))

	// Internal message should have key redacted
	if strings.Contains(pErr.Message, apiKey) {
		t.Errorf("Message should not contain raw API key. Got: %q", pErr.Message)
	}
}

// Helper to create error from string
type stringError string

func (e stringError) Error() string { return string(e) }

func errFromString(s string) error {
	return stringError(s)
}
