package providers

import "context"

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
	Messages     []Message `json:"messages"`
	Model        string    `json:"model"`
	MaxTokens    int       `json:"max_tokens"`
	SystemPrompt string    `json:"system_prompt,omitempty"`
}

// StreamChunk represents a single chunk in a streaming response.
type StreamChunk struct {
	Type      string      `json:"type"`       // start, chunk, end, error, thinking
	Content   string      `json:"content"`    // text delta for chunk/thinking type
	MessageID string      `json:"message_id"` // unique message identifier
	Index     int         `json:"index"`      // chunk sequence number
	Usage     *UsageStats `json:"usage,omitempty"`
	Model     string      `json:"model,omitempty"` // model identifier, populated on start
}

// UsageStats contains token usage information.
type UsageStats struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Model represents an available LLM model.
type Model struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Provider  string `json:"provider"`
	MaxTokens int    `json:"max_tokens"`
}

// Message represents a single message in a conversation.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
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
