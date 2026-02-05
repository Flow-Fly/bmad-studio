package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"bmad-studio/backend/types"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/packages/param"
	"github.com/openai/openai-go/v3/shared"
)

// openaiModels is the hardcoded list of available OpenAI models.
var openaiModels = []Model{
	{
		ID:            string(openai.ChatModelGPT4o),
		Name:          "GPT-4o",
		Provider:      "openai",
		MaxTokens:     16384,
		SupportsTools: true,
	},
	{
		ID:            string(openai.ChatModelGPT4oMini),
		Name:          "GPT-4o mini",
		Provider:      "openai",
		MaxTokens:     16384,
		SupportsTools: true,
	},
	{
		ID:            string(openai.ChatModelGPT4_1),
		Name:          "GPT-4.1",
		Provider:      "openai",
		MaxTokens:     32768,
		SupportsTools: true,
	},
	{
		ID:            string(openai.ChatModelGPT4_1Mini),
		Name:          "GPT-4.1 mini",
		Provider:      "openai",
		MaxTokens:     32768,
		SupportsTools: true,
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
	messages, err := buildOpenAIMessages(req)
	if err != nil {
		return nil, err
	}

	params := openai.ChatCompletionNewParams{
		Model:     openai.ChatModel(req.Model),
		Messages:  messages,
		MaxTokens: openai.Int(int64(req.MaxTokens)),
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: openai.Bool(true),
		},
	}

	// Convert tool definitions to OpenAI format
	if len(req.Tools) > 0 {
		params.Tools = buildOpenAITools(req.Tools)
	}

	stream := p.client.Chat.Completions.NewStreaming(ctx, params)

	ch := make(chan StreamChunk, 32)

	go func() {
		defer close(ch)
		defer stream.Close()

		var messageID string
		chunkIndex := 0
		ended := false

		// Track active tool calls by index
		type toolCallAcc struct {
			id   string
			name string
			seen bool // whether tool_call_start was emitted
		}
		activeToolCalls := make(map[int64]*toolCallAcc)

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
					Type:      ChunkTypeStart,
					MessageID: messageID,
				}) {
					return
				}
			}

			if len(chunk.Choices) > 0 {
				choice := chunk.Choices[0]

				// Handle text content
				delta := choice.Delta.Content
				if delta != "" {
					if !send(StreamChunk{
						Type:      ChunkTypeChunk,
						Content:   delta,
						MessageID: messageID,
						Index:     chunkIndex,
					}) {
						return
					}
					chunkIndex++
				}

				// Handle tool calls in delta
				for _, tc := range choice.Delta.ToolCalls {
					acc, exists := activeToolCalls[tc.Index]
					if !exists {
						// First appearance of this tool call
						acc = &toolCallAcc{
							id:   tc.ID,
							name: tc.Function.Name,
						}
						activeToolCalls[tc.Index] = acc
					}

					// Emit start on first encounter
					if !acc.seen {
						acc.seen = true
						if !send(StreamChunk{
							Type:      ChunkTypeToolCallStart,
							ToolID:    acc.id,
							ToolName:  acc.name,
							MessageID: messageID,
						}) {
							return
						}
					}

					// Emit delta for argument fragments
					if tc.Function.Arguments != "" {
						if !send(StreamChunk{
							Type:      ChunkTypeToolCallDelta,
							ToolID:    acc.id,
							Content:   tc.Function.Arguments,
							MessageID: messageID,
						}) {
							return
						}
					}
				}

				// Check for tool_calls finish reason → emit tool_call_end for each active tool
				if choice.FinishReason == "tool_calls" {
					for _, acc := range activeToolCalls {
						if !send(StreamChunk{
							Type:      ChunkTypeToolCallEnd,
							ToolID:    acc.id,
							MessageID: messageID,
						}) {
							return
						}
					}
					activeToolCalls = make(map[int64]*toolCallAcc)
				}
			}

			if chunk.Usage.TotalTokens > 0 {
				ended = true
				if !send(StreamChunk{
					Type:      ChunkTypeEnd,
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
				Type:      ChunkTypeError,
				Content:   providerErr.UserMessage,
				MessageID: messageID,
			})
		} else if !ended {
			send(StreamChunk{
				Type:      ChunkTypeEnd,
				MessageID: messageID,
			})
		}
	}()

	return ch, nil
}

// buildOpenAIMessages converts ChatRequest messages to OpenAI message params.
func buildOpenAIMessages(req ChatRequest) ([]openai.ChatCompletionMessageParamUnion, error) {
	messages := make([]openai.ChatCompletionMessageParamUnion, 0, len(req.Messages)+1)

	if req.SystemPrompt != "" {
		messages = append(messages, openai.SystemMessage(req.SystemPrompt))
	}

	for _, msg := range req.Messages {
		switch msg.Role {
		case "user":
			messages = append(messages, openai.UserMessage(msg.Content))

		case "assistant":
			if len(msg.ToolCalls) > 0 {
				// Assistant message with tool calls
				toolCalls := make([]openai.ChatCompletionMessageToolCallUnionParam, 0, len(msg.ToolCalls))
				for _, tc := range msg.ToolCalls {
					toolCalls = append(toolCalls, openai.ChatCompletionMessageToolCallUnionParam{
						OfFunction: &openai.ChatCompletionMessageFunctionToolCallParam{
							ID: tc.ID,
							Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
								Name:      tc.Name,
								Arguments: string(tc.Input),
							},
						},
					})
				}
				messages = append(messages, openai.ChatCompletionMessageParamUnion{
					OfAssistant: &openai.ChatCompletionAssistantMessageParam{
						Content: openai.ChatCompletionAssistantMessageParamContentUnion{
							OfString: param.NewOpt(msg.Content),
						},
						ToolCalls: toolCalls,
					},
				})
			} else {
				messages = append(messages, openai.AssistantMessage(msg.Content))
			}

		case "tool":
			messages = append(messages, openai.ToolMessage(msg.Content, msg.ToolCallID))

		default:
			return nil, &ProviderError{
				Code:        "invalid_role",
				Message:     fmt.Sprintf("unsupported message role: %s", msg.Role),
				UserMessage: fmt.Sprintf("Unsupported message role: %s. Use 'user', 'assistant', or 'tool'.", msg.Role),
			}
		}
	}
	return messages, nil
}

// buildOpenAITools converts ToolDefinitions to OpenAI function tool format.
func buildOpenAITools(defs []types.ToolDefinition) []openai.ChatCompletionToolUnionParam {
	tools := make([]openai.ChatCompletionToolUnionParam, 0, len(defs))
	for _, td := range defs {
		var params shared.FunctionParameters
		if err := json.Unmarshal(td.InputSchema, &params); err != nil {
			continue
		}

		tools = append(tools, openai.ChatCompletionFunctionTool(shared.FunctionDefinitionParam{
			Name:        td.Name,
			Description: param.NewOpt(td.Description),
			Parameters:  params,
		}))
	}
	return tools
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
