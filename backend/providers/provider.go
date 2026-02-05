package providers

import (
	"context"
	"encoding/json"

	"bmad-studio/backend/types"
)

// Provider is the interface ALL providers must implement.
type Provider interface {
	// SendMessage sends a chat message and returns a channel of streaming chunks.
	SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error)

	// ValidateCredentials checks if the provider's credentials are valid.
	ValidateCredentials(ctx context.Context) error

	// ListModels returns the models available from this provider.
	ListModels() ([]Model, error)
}

// ChatRequest contains the parameters for a chat message.
type ChatRequest struct {
	Messages     []Message            `json:"messages"`
	Model        string               `json:"model"`
	MaxTokens    int                  `json:"max_tokens"`
	SystemPrompt string               `json:"system_prompt,omitempty"`
	Tools        []types.ToolDefinition `json:"tools,omitempty"`
}

// StreamChunk type constants.
const (
	ChunkTypeStart         = "start"
	ChunkTypeChunk         = "chunk"
	ChunkTypeThinking      = "thinking"
	ChunkTypeEnd           = "end"
	ChunkTypeError         = "error"
	ChunkTypeToolCallStart = "tool_call_start"
	ChunkTypeToolCallDelta = "tool_call_delta"
	ChunkTypeToolCallEnd   = "tool_call_end"
)

// StreamChunk represents a single chunk in a streaming response.
type StreamChunk struct {
	Type      string      `json:"type"`                  // start, chunk, end, error, thinking, tool_call_start, tool_call_delta, tool_call_end
	Content   string      `json:"content"`               // text delta for chunk/thinking type, partial JSON for tool_call_delta
	MessageID string      `json:"message_id"`            // unique message identifier
	Index     int         `json:"index"`                 // chunk sequence number
	Usage     *UsageStats `json:"usage,omitempty"`
	Model     string      `json:"model,omitempty"`       // model identifier, populated on start
	ToolID    string      `json:"toolId,omitempty"`      // unique per tool call
	ToolName  string      `json:"toolName,omitempty"`    // populated on tool_call_start only
}

// UsageStats contains token usage information.
type UsageStats struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Model represents an available LLM model.
type Model struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Provider      string `json:"provider"`
	MaxTokens     int    `json:"max_tokens"`
	SupportsTools bool   `json:"supports_tools"`
}

// Message represents a single message in a conversation.
type Message struct {
	Role       string           `json:"role"`
	Content    string           `json:"content"`
	ToolCallID string           `json:"toolCallId,omitempty"` // set when Role is "tool" (result message)
	ToolCalls  []types.ToolCall `json:"toolCalls,omitempty"`  // set when assistant requests tool use
	ToolName   string           `json:"toolName,omitempty"`   // tool name for result messages
}

// ContentBlock represents a content block within a multi-part message.
// Used internally when building provider-specific message formats.
type ContentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   string          `json:"content,omitempty"`
}

// ProviderError is a structured error from provider operations.
type ProviderError struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	UserMessage string `json:"user_message"`
}

func (e *ProviderError) Error() string {
	return e.UserMessage
}
