package providers

import (
	"context"
	"errors"
	"fmt"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
)

// openaiModels is the hardcoded list of available OpenAI models.
var openaiModels = []Model{
	{
		ID:        string(openai.ChatModelGPT4o),
		Name:      "GPT-4o",
		Provider:  "openai",
		MaxTokens: 16384,
	},
	{
		ID:        string(openai.ChatModelGPT4oMini),
		Name:      "GPT-4o mini",
		Provider:  "openai",
		MaxTokens: 16384,
	},
	{
		ID:        string(openai.ChatModelGPT4_1),
		Name:      "GPT-4.1",
		Provider:  "openai",
		MaxTokens: 32768,
	},
	{
		ID:        string(openai.ChatModelGPT4_1Mini),
		Name:      "GPT-4.1 mini",
		Provider:  "openai",
		MaxTokens: 32768,
	},
}

// OpenAIProvider implements the Provider interface for the OpenAI API.
type OpenAIProvider struct {
	client *openai.Client
}

// NewOpenAIProvider creates a new OpenAIProvider with the given API key.
func NewOpenAIProvider(apiKey string) *OpenAIProvider {
	client := openai.NewClient(
		option.WithAPIKey(apiKey),
	)
	return &OpenAIProvider{client: &client}
}

// ValidateCredentials checks if the API key is valid by sending a minimal request.
func (p *OpenAIProvider) ValidateCredentials(ctx context.Context) error {
	_, err := p.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model: openai.ChatModelGPT4oMini,
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage("hi"),
		},
		MaxTokens: openai.Int(1),
	})
	if err != nil {
		return mapOpenAIProviderError(err)
	}
	return nil
}

// ListModels returns the hardcoded list of available OpenAI models.
func (p *OpenAIProvider) ListModels() ([]Model, error) {
	models := make([]Model, len(openaiModels))
	copy(models, openaiModels)
	return models, nil
}

// SendMessage sends a chat request and returns a channel streaming response chunks.
func (p *OpenAIProvider) SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	messages := make([]openai.ChatCompletionMessageParamUnion, 0, len(req.Messages)+1)

	if req.SystemPrompt != "" {
		messages = append(messages, openai.SystemMessage(req.SystemPrompt))
	}

	for _, msg := range req.Messages {
		switch msg.Role {
		case "user":
			messages = append(messages, openai.UserMessage(msg.Content))
		case "assistant":
			messages = append(messages, openai.AssistantMessage(msg.Content))
		default:
			return nil, &ProviderError{
				Code:        "invalid_role",
				Message:     fmt.Sprintf("unsupported message role: %s", msg.Role),
				UserMessage: fmt.Sprintf("Unsupported message role: %s. Use 'user' or 'assistant'.", msg.Role),
			}
		}
	}

	params := openai.ChatCompletionNewParams{
		Model:     openai.ChatModel(req.Model),
		Messages:  messages,
		MaxTokens: openai.Int(int64(req.MaxTokens)),
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: openai.Bool(true),
		},
	}

	stream := p.client.Chat.Completions.NewStreaming(ctx, params)

	ch := make(chan StreamChunk, 32)

	go func() {
		defer close(ch)
		defer stream.Close()

		var messageID string
		chunkIndex := 0
		ended := false

		send := func(chunk StreamChunk) bool {
			select {
			case ch <- chunk:
				return true
			case <-ctx.Done():
				return false
			}
		}

		for stream.Next() {
			chunk := stream.Current()

			if messageID == "" && chunk.ID != "" {
				messageID = chunk.ID
				if !send(StreamChunk{
					Type:      "start",
					MessageID: messageID,
				}) {
					return
				}
			}

			if len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta.Content
				if delta != "" {
					if !send(StreamChunk{
						Type:      "chunk",
						Content:   delta,
						MessageID: messageID,
						Index:     chunkIndex,
					}) {
						return
					}
					chunkIndex++
				}
			}

			if chunk.Usage.TotalTokens > 0 {
				ended = true
				if !send(StreamChunk{
					Type:      "end",
					MessageID: messageID,
					Usage: &UsageStats{
						InputTokens:  int(chunk.Usage.PromptTokens),
						OutputTokens: int(chunk.Usage.CompletionTokens),
					},
				}) {
					return
				}
			}
		}

		if err := stream.Err(); err != nil && !ended {
			providerErr := mapOpenAIProviderError(err)
			send(StreamChunk{
				Type:      "error",
				Content:   providerErr.UserMessage,
				MessageID: messageID,
			})
		} else if !ended {
			send(StreamChunk{
				Type:      "end",
				MessageID: messageID,
			})
		}
	}()

	return ch, nil
}

// mapOpenAIProviderError converts OpenAI SDK errors to user-friendly ProviderError values.
// API keys must never appear in the returned error messages (NFR6).
func mapOpenAIProviderError(err error) *ProviderError {
	var apiErr *openai.Error
	if errors.As(err, &apiErr) {
		switch apiErr.StatusCode {
		case 401:
			return &ProviderError{
				Code:        "auth_error",
				Message:     "authentication failed",
				UserMessage: "Invalid API key. Please check your OpenAI API key and try again.",
			}
		case 429:
			return &ProviderError{
				Code:        "rate_limit",
				Message:     "rate limited",
				UserMessage: "Rate limit reached. Please wait a moment and try again.",
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
				UserMessage: "An error occurred communicating with OpenAI. Please try again.",
			}
		}
	}

	return &ProviderError{
		Code:        "provider_error",
		Message:     "unexpected error",
		UserMessage: "An unexpected error occurred. Please try again.",
	}
}
