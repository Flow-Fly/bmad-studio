package providers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"bmad-studio/backend/types"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/anthropics/anthropic-sdk-go/packages/param"
)

// claudeModels is the hardcoded list of available Claude models.
var claudeModels = []Model{
	{
		ID:            string(anthropic.ModelClaudeOpus4_5_20251101),
		Name:          "Claude Opus 4.5",
		Provider:      "claude",
		MaxTokens:     32768,
		SupportsTools: true,
	},
	{
		ID:            string(anthropic.ModelClaudeSonnet4_5_20250929),
		Name:          "Claude Sonnet 4.5",
		Provider:      "claude",
		MaxTokens:     16384,
		SupportsTools: true,
	},
	{
		ID:            string(anthropic.ModelClaudeHaiku4_5_20251001),
		Name:          "Claude Haiku 4.5",
		Provider:      "claude",
		MaxTokens:     8192,
		SupportsTools: true,
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

// RequiresAPIKey returns true as Claude requires an API key.
func (p *ClaudeProvider) RequiresAPIKey() bool {
	return true
}

// SendMessage sends a chat request and returns a channel streaming response chunks.
func (p *ClaudeProvider) SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	messages, err := buildClaudeMessages(req.Messages)
	if err != nil {
		return nil, err
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

	// Convert tool definitions to Anthropic format
	if len(req.Tools) > 0 {
		params.Tools = buildClaudeTools(req.Tools)
	}

	stream := p.client.Messages.NewStreaming(ctx, params)

	ch := make(chan StreamChunk, 32)

	go func() {
		defer close(ch)

		var messageID string
		chunkIndex := 0
		ended := false
		acc := anthropic.Message{}

		// Track tool blocks by content block index
		toolBlockIDs := make(map[int64]string) // blockIndex → toolID

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
					Type:      ChunkTypeStart,
					MessageID: messageID,
					Model:     string(event.Message.Model),
				}) {
					return
				}

			case anthropic.ContentBlockStartEvent:
				if event.ContentBlock.Type == "tool_use" {
					toolUse := event.ContentBlock.AsToolUse()
					toolBlockIDs[event.Index] = toolUse.ID
					if !send(StreamChunk{
						Type:      ChunkTypeToolCallStart,
						ToolID:    toolUse.ID,
						ToolName:  toolUse.Name,
						MessageID: messageID,
					}) {
						return
					}
				}

			case anthropic.ContentBlockDeltaEvent:
				switch delta := event.Delta.AsAny().(type) {
				case anthropic.TextDelta:
					if !send(StreamChunk{
						Type:      ChunkTypeChunk,
						Content:   delta.Text,
						MessageID: messageID,
						Index:     chunkIndex,
					}) {
						return
					}
					chunkIndex++
				case anthropic.ThinkingDelta:
					if !send(StreamChunk{
						Type:      ChunkTypeThinking,
						Content:   delta.Thinking,
						MessageID: messageID,
						Index:     chunkIndex,
					}) {
						return
					}
					chunkIndex++
				case anthropic.InputJSONDelta:
					toolID := toolBlockIDs[event.Index]
					if !send(StreamChunk{
						Type:      ChunkTypeToolCallDelta,
						ToolID:    toolID,
						Content:   delta.PartialJSON,
						MessageID: messageID,
					}) {
						return
					}
				}

			case anthropic.ContentBlockStopEvent:
				if toolID, ok := toolBlockIDs[event.Index]; ok {
					if !send(StreamChunk{
						Type:      ChunkTypeToolCallEnd,
						ToolID:    toolID,
						MessageID: messageID,
					}) {
						return
					}
					delete(toolBlockIDs, event.Index)
				}

			case anthropic.MessageDeltaEvent:
				ended = true
				if !send(StreamChunk{
					Type:      ChunkTypeEnd,
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
				Type:      ChunkTypeError,
				Content:   providerErr.UserMessage,
				MessageID: messageID,
			})
		}
	}()

	return ch, nil
}

// buildClaudeMessages converts provider Messages to Anthropic MessageParams,
// handling text, tool_use (assistant), and tool_result (tool) roles.
func buildClaudeMessages(msgs []Message) ([]anthropic.MessageParam, error) {
	messages := make([]anthropic.MessageParam, 0, len(msgs))
	for _, msg := range msgs {
		switch msg.Role {
		case "user":
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content)))

		case "assistant":
			if len(msg.ToolCalls) > 0 {
				// Assistant message with tool use blocks
				blocks := make([]anthropic.ContentBlockParamUnion, 0, len(msg.ToolCalls)+1)
				if msg.Content != "" {
					blocks = append(blocks, anthropic.NewTextBlock(msg.Content))
				}
				for _, tc := range msg.ToolCalls {
					var inputMap interface{}
					if err := json.Unmarshal(tc.Input, &inputMap); err != nil {
						inputMap = map[string]interface{}{}
					}
					blocks = append(blocks, anthropic.NewToolUseBlock(tc.ID, inputMap, tc.Name))
				}
				messages = append(messages, anthropic.NewAssistantMessage(blocks...))
			} else {
				messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content)))
			}

		case "tool":
			// Tool result message → Anthropic expects this as a user message with tool_result block
			messages = append(messages, anthropic.NewUserMessage(
				anthropic.NewToolResultBlock(msg.ToolCallID, msg.Content, false),
			))

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

// buildClaudeTools converts ToolDefinitions to Anthropic ToolUnionParam format.
func buildClaudeTools(defs []types.ToolDefinition) []anthropic.ToolUnionParam {
	tools := make([]anthropic.ToolUnionParam, 0, len(defs))
	for _, td := range defs {
		// Parse the JSON schema to extract properties and required fields
		var schema map[string]interface{}
		if err := json.Unmarshal(td.InputSchema, &schema); err != nil {
			continue
		}

		inputSchema := anthropic.ToolInputSchemaParam{
			Type: "object",
		}
		if props, ok := schema["properties"]; ok {
			inputSchema.Properties = props
		}
		if req, ok := schema["required"].([]interface{}); ok {
			required := make([]string, 0, len(req))
			for _, r := range req {
				if s, ok := r.(string); ok {
					required = append(required, s)
				}
			}
			inputSchema.Required = required
		}

		tool := anthropic.ToolUnionParam{
			OfTool: &anthropic.ToolParam{
				Name:        td.Name,
				Description: param.NewOpt(td.Description),
				InputSchema: inputSchema,
			},
		}
		tools = append(tools, tool)
	}
	return tools
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
