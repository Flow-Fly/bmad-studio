package providers

import (
	"context"
	"errors"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// claudeModels is the hardcoded list of available Claude models.
var claudeModels = []Model{
	{
		ID:        string(anthropic.ModelClaudeOpus4_5_20251101),
		Name:      "Claude Opus 4.5",
		Provider:  "claude",
		MaxTokens: 32768,
	},
	{
		ID:        string(anthropic.ModelClaudeSonnet4_5_20250929),
		Name:      "Claude Sonnet 4.5",
		Provider:  "claude",
		MaxTokens: 16384,
	},
	{
		ID:        string(anthropic.ModelClaudeHaiku4_5_20251001),
		Name:      "Claude Haiku 4.5",
		Provider:  "claude",
		MaxTokens: 8192,
	},
}

// ClaudeProvider implements the Provider interface for the Anthropic Claude API.
type ClaudeProvider struct {
	client *anthropic.Client
}

// NewClaudeProvider creates a new ClaudeProvider with the given API key.
func NewClaudeProvider(apiKey string) *ClaudeProvider {
	client := anthropic.NewClient(
		option.WithAPIKey(apiKey),
	)
	return &ClaudeProvider{client: &client}
}

// ValidateCredentials checks if the API key is valid by sending a minimal request.
func (p *ClaudeProvider) ValidateCredentials(ctx context.Context) error {
	_, err := p.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.ModelClaudeHaiku4_5_20251001,
		MaxTokens: 1,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock("hi")),
		},
	})
	if err != nil {
		return mapProviderError(err)
	}
	return nil
}

// ListModels returns the hardcoded list of available Claude models.
func (p *ClaudeProvider) ListModels() ([]Model, error) {
	models := make([]Model, len(claudeModels))
	copy(models, claudeModels)
	return models, nil
}

// SendMessage sends a chat request and returns a channel streaming response chunks.
func (p *ClaudeProvider) SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	messages := make([]anthropic.MessageParam, 0, len(req.Messages))
	for _, msg := range req.Messages {
		switch msg.Role {
		case "user":
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content)))
		case "assistant":
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content)))
		default:
			return nil, &ProviderError{
				Code:        "invalid_role",
				Message:     fmt.Sprintf("unsupported message role: %s", msg.Role),
				UserMessage: fmt.Sprintf("Unsupported message role: %s. Use 'user' or 'assistant'.", msg.Role),
			}
		}
	}

	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(req.Model),
		MaxTokens: int64(req.MaxTokens),
		Messages:  messages,
	}

	if req.SystemPrompt != "" {
		params.System = []anthropic.TextBlockParam{
			{Text: req.SystemPrompt},
		}
	}

	stream := p.client.Messages.NewStreaming(ctx, params)

	ch := make(chan StreamChunk, 32)

	go func() {
		defer close(ch)

		var messageID string
		chunkIndex := 0
		ended := false
		acc := anthropic.Message{}

		send := func(chunk StreamChunk) bool {
			select {
			case ch <- chunk:
				return true
			case <-ctx.Done():
				return false
			}
		}

		for stream.Next() {
			event := stream.Current()
			acc.Accumulate(event)

			switch event := event.AsAny().(type) {
			case anthropic.MessageStartEvent:
				messageID = event.Message.ID
				if !send(StreamChunk{
					Type:      "start",
					MessageID: messageID,
				}) {
					return
				}

			case anthropic.ContentBlockDeltaEvent:
				if delta, ok := event.Delta.AsAny().(anthropic.TextDelta); ok {
					if !send(StreamChunk{
						Type:      "chunk",
						Content:   delta.Text,
						MessageID: messageID,
						Index:     chunkIndex,
					}) {
						return
					}
					chunkIndex++
				}

			case anthropic.MessageDeltaEvent:
				ended = true
				if !send(StreamChunk{
					Type:      "end",
					MessageID: messageID,
					Usage: &UsageStats{
						InputTokens:  int(acc.Usage.InputTokens),
						OutputTokens: int(acc.Usage.OutputTokens),
					},
				}) {
					return
				}
			}
		}

		if err := stream.Err(); err != nil && !ended {
			providerErr := mapProviderError(err)
			send(StreamChunk{
				Type:      "error",
				Content:   providerErr.UserMessage,
				MessageID: messageID,
			})
		}
	}()

	return ch, nil
}

// mapProviderError converts SDK errors to user-friendly ProviderError values.
// API keys must never appear in the returned error messages (NFR6).
func mapProviderError(err error) *ProviderError {
	var apiErr *anthropic.Error
	if errors.As(err, &apiErr) {
		switch apiErr.StatusCode {
		case 401:
			return &ProviderError{
				Code:        "auth_error",
				Message:     "authentication failed",
				UserMessage: "Invalid API key. Please check your Claude API key and try again.",
			}
		case 429:
			return &ProviderError{
				Code:        "rate_limit",
				Message:     "rate limited",
				UserMessage: "Rate limit reached. Please wait a moment and try again.",
			}
		case 529:
			return &ProviderError{
				Code:        "overloaded",
				Message:     "server overloaded",
				UserMessage: "Claude is currently overloaded. Please try again shortly.",
			}
		case 400:
			return &ProviderError{
				Code:        "invalid_request",
				Message:     "invalid request",
				UserMessage: "The request was invalid. Please check your input and try again.",
			}
		default:
			return &ProviderError{
				Code:        "provider_error",
				Message:     fmt.Sprintf("API error (status %d)", apiErr.StatusCode),
				UserMessage: "An error occurred communicating with Claude. Please try again.",
			}
		}
	}

	return &ProviderError{
		Code:        "provider_error",
		Message:     "unexpected error",
		UserMessage: "An unexpected error occurred. Please try again.",
	}
}
