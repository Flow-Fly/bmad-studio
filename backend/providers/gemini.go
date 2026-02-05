package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"bmad-studio/backend/types"

	"github.com/google/uuid"
	"google.golang.org/genai"
)

// geminiModels is the hardcoded list of available Gemini models.
// Using hardcoded list to match Claude/OpenAI pattern and avoid requiring
// API key for model listing (ProviderService.ListProviderModels passes empty key).
var geminiModels = []Model{
	{
		ID:            "gemini-2.0-flash",
		Name:          "Gemini 2.0 Flash",
		Provider:      "gemini",
		MaxTokens:     8192,
		SupportsTools: true,
	},
	{
		ID:            "gemini-1.5-pro",
		Name:          "Gemini 1.5 Pro",
		Provider:      "gemini",
		MaxTokens:     8192,
		SupportsTools: true,
	},
	{
		ID:            "gemini-1.5-flash",
		Name:          "Gemini 1.5 Flash",
		Provider:      "gemini",
		MaxTokens:     8192,
		SupportsTools: true,
	},
}

// GeminiProvider implements the Provider interface for the Google Gemini API.
type GeminiProvider struct {
	apiKey string
}

// NewGeminiProvider creates a new GeminiProvider with the given API key.
func NewGeminiProvider(apiKey string) *GeminiProvider {
	return &GeminiProvider{apiKey: apiKey}
}

// ValidateCredentials checks if the API key is valid by fetching model metadata.
// Uses metadata endpoint instead of generating content to avoid wasting tokens.
func (p *GeminiProvider) ValidateCredentials(ctx context.Context) error {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  p.apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return mapGeminiProviderError(err)
	}

	// Fetch model metadata to validate credentials without generating content
	_, err = client.Models.Get(ctx, "gemini-2.0-flash", nil)
	if err != nil {
		return mapGeminiProviderError(err)
	}
	return nil
}

// ListModels returns the hardcoded list of available Gemini models.
func (p *GeminiProvider) ListModels() ([]Model, error) {
	models := make([]Model, len(geminiModels))
	copy(models, geminiModels)
	return models, nil
}

// RequiresAPIKey returns true as Gemini requires an API key.
func (p *GeminiProvider) RequiresAPIKey() bool {
	return true
}

// SendMessage sends a chat request and returns a channel streaming response chunks.
func (p *GeminiProvider) SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  p.apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, mapGeminiProviderError(err)
	}

	contents, err := buildGeminiMessages(req.Messages)
	if err != nil {
		return nil, err
	}

	config := &genai.GenerateContentConfig{
		MaxOutputTokens: int32(req.MaxTokens),
	}

	if req.SystemPrompt != "" {
		config.SystemInstruction = &genai.Content{
			Parts: []*genai.Part{{Text: req.SystemPrompt}},
		}
	}

	if len(req.Tools) > 0 {
		config.Tools = buildGeminiTools(req.Tools)
	}

	ch := make(chan StreamChunk, 32)
	messageID := uuid.New().String()

	go func() {
		defer close(ch)

		chunkIndex := 0
		ended := false
		var totalInputTokens, totalOutputTokens int

		send := func(chunk StreamChunk) bool {
			select {
			case ch <- chunk:
				return true
			case <-ctx.Done():
				return false
			}
		}

		// Send start chunk
		if !send(StreamChunk{
			Type:      ChunkTypeStart,
			MessageID: messageID,
			Model:     req.Model,
		}) {
			return
		}

		// Stream responses
		for resp, err := range client.Models.GenerateContentStream(ctx, req.Model, contents, config) {
			if err != nil {
				providerErr := mapGeminiProviderError(err)
				send(StreamChunk{
					Type:      ChunkTypeError,
					Content:   providerErr.UserMessage,
					MessageID: messageID,
				})
				return
			}

			// Track usage
			if resp.UsageMetadata != nil {
				totalInputTokens = int(resp.UsageMetadata.PromptTokenCount)
				totalOutputTokens = int(resp.UsageMetadata.CandidatesTokenCount)
			}

			// Process candidates
			for _, candidate := range resp.Candidates {
				if candidate.Content == nil {
					continue
				}

				for _, part := range candidate.Content.Parts {
					// Handle text content
					if part.Text != "" {
						if !send(StreamChunk{
							Type:      ChunkTypeChunk,
							Content:   part.Text,
							MessageID: messageID,
							Index:     chunkIndex,
						}) {
							return
						}
						chunkIndex++
					}

					// Handle function calls
					if part.FunctionCall != nil {
						toolID := uuid.New().String()

						// Emit tool_call_start
						if !send(StreamChunk{
							Type:      ChunkTypeToolCallStart,
							ToolID:    toolID,
							ToolName:  part.FunctionCall.Name,
							MessageID: messageID,
						}) {
							return
						}

						// Emit tool_call_delta with JSON args
						argsJSON, _ := json.Marshal(part.FunctionCall.Args)
						if !send(StreamChunk{
							Type:      ChunkTypeToolCallDelta,
							ToolID:    toolID,
							Content:   string(argsJSON),
							MessageID: messageID,
						}) {
							return
						}

						// Emit tool_call_end
						if !send(StreamChunk{
							Type:      ChunkTypeToolCallEnd,
							ToolID:    toolID,
							MessageID: messageID,
						}) {
							return
						}
					}
				}
			}
		}

		// Send end chunk
		ended = true
		if ended {
			send(StreamChunk{
				Type:      ChunkTypeEnd,
				MessageID: messageID,
				Usage: &UsageStats{
					InputTokens:  totalInputTokens,
					OutputTokens: totalOutputTokens,
				},
			})
		}
	}()

	return ch, nil
}

// buildGeminiMessages converts provider Messages to Gemini Content format.
func buildGeminiMessages(msgs []Message) ([]*genai.Content, error) {
	var contents []*genai.Content

	for _, msg := range msgs {
		switch msg.Role {
		case "user":
			contents = append(contents, &genai.Content{
				Role:  "user",
				Parts: []*genai.Part{{Text: msg.Content}},
			})

		case "assistant":
			parts := []*genai.Part{}
			if msg.Content != "" {
				parts = append(parts, &genai.Part{Text: msg.Content})
			}
			// Add function calls if present
			for _, tc := range msg.ToolCalls {
				var args map[string]any
				if err := json.Unmarshal(tc.Input, &args); err != nil {
					args = map[string]any{}
				}
				parts = append(parts, &genai.Part{
					FunctionCall: &genai.FunctionCall{
						Name: tc.Name,
						Args: args,
					},
				})
			}
			contents = append(contents, &genai.Content{
				Role:  "model",
				Parts: parts,
			})

		case "tool":
			// Tool result → function response
			// Validate ToolName is present (required by Gemini API)
			if msg.ToolName == "" {
				return nil, &ProviderError{
					Code:        "invalid_tool_result",
					Message:     "tool result message missing ToolName",
					UserMessage: "Tool result is missing the tool name. This is required for Gemini API.",
				}
			}
			var resultData map[string]any
			if err := json.Unmarshal([]byte(msg.Content), &resultData); err != nil {
				// If not valid JSON object, wrap as string
				resultData = map[string]any{"result": msg.Content}
			}
			contents = append(contents, &genai.Content{
				Role: "user",
				Parts: []*genai.Part{{
					FunctionResponse: &genai.FunctionResponse{
						Name:     msg.ToolName,
						Response: resultData,
					},
				}},
			})

		default:
			return nil, &ProviderError{
				Code:        "invalid_role",
				Message:     fmt.Sprintf("unsupported message role: %s", msg.Role),
				UserMessage: fmt.Sprintf("Unsupported message role: %s. Use 'user', 'assistant', or 'tool'.", msg.Role),
			}
		}
	}

	return contents, nil
}

// buildGeminiTools converts ToolDefinitions to Gemini Tool format.
// Note: Tools with invalid JSON schemas are silently skipped to match
// Claude/OpenAI provider behavior. This ensures partial tool sets still work.
func buildGeminiTools(defs []types.ToolDefinition) []*genai.Tool {
	var declarations []*genai.FunctionDeclaration

	for _, td := range defs {
		// Parse the JSON schema - skip tools with invalid schemas
		// (matches Claude/OpenAI behavior of graceful degradation)
		var schema map[string]any
		if err := json.Unmarshal(td.InputSchema, &schema); err != nil {
			continue
		}

		// Build Gemini schema from JSON schema
		geminiSchema := buildGeminiSchema(schema)

		declarations = append(declarations, &genai.FunctionDeclaration{
			Name:        td.Name,
			Description: td.Description,
			Parameters:  geminiSchema,
		})
	}

	return []*genai.Tool{{
		FunctionDeclarations: declarations,
	}}
}

// buildGeminiSchema converts a JSON schema to Gemini Schema format.
func buildGeminiSchema(schema map[string]any) *genai.Schema {
	geminiSchema := &genai.Schema{
		Type: genai.TypeObject,
	}

	if props, ok := schema["properties"].(map[string]any); ok {
		geminiSchema.Properties = make(map[string]*genai.Schema)
		for name, propSchema := range props {
			if propMap, ok := propSchema.(map[string]any); ok {
				geminiSchema.Properties[name] = buildPropertySchema(propMap)
			}
		}
	}

	if required, ok := schema["required"].([]any); ok {
		for _, r := range required {
			if s, ok := r.(string); ok {
				geminiSchema.Required = append(geminiSchema.Required, s)
			}
		}
	}

	return geminiSchema
}

// buildPropertySchema converts a property schema to Gemini Schema.
func buildPropertySchema(propSchema map[string]any) *genai.Schema {
	schema := &genai.Schema{}

	if t, ok := propSchema["type"].(string); ok {
		switch t {
		case "string":
			schema.Type = genai.TypeString
		case "number":
			schema.Type = genai.TypeNumber
		case "integer":
			schema.Type = genai.TypeInteger
		case "boolean":
			schema.Type = genai.TypeBoolean
		case "array":
			schema.Type = genai.TypeArray
			if items, ok := propSchema["items"].(map[string]any); ok {
				schema.Items = buildPropertySchema(items)
			}
		case "object":
			schema.Type = genai.TypeObject
			if props, ok := propSchema["properties"].(map[string]any); ok {
				schema.Properties = make(map[string]*genai.Schema)
				for name, subSchema := range props {
					if subMap, ok := subSchema.(map[string]any); ok {
						schema.Properties[name] = buildPropertySchema(subMap)
					}
				}
			}
		}
	}

	if desc, ok := propSchema["description"].(string); ok {
		schema.Description = desc
	}

	if enum, ok := propSchema["enum"].([]any); ok {
		for _, e := range enum {
			if s, ok := e.(string); ok {
				schema.Enum = append(schema.Enum, s)
			}
		}
	}

	return schema
}

// mapGeminiProviderError converts SDK errors to user-friendly ProviderError values.
// API keys must never appear in the returned error messages (NFR6).
func mapGeminiProviderError(err error) *ProviderError {
	if err == nil {
		return nil
	}

	errStr := err.Error()

	// Check for status codes in error message
	if strings.Contains(errStr, "401") || strings.Contains(errStr, "403") ||
		strings.Contains(strings.ToLower(errStr), "api key") ||
		strings.Contains(strings.ToLower(errStr), "permission denied") {
		return &ProviderError{
			Code:        "auth_error",
			Message:     "authentication failed",
			UserMessage: "Invalid API key. Please check your Gemini API key and try again.",
		}
	}

	if strings.Contains(errStr, "429") || strings.Contains(strings.ToLower(errStr), "quota") ||
		strings.Contains(strings.ToLower(errStr), "rate") {
		return &ProviderError{
			Code:        "rate_limit",
			Message:     "rate limited",
			UserMessage: "Rate limit reached. Please wait a moment and try again.",
		}
	}

	if strings.Contains(errStr, "400") || strings.Contains(strings.ToLower(errStr), "invalid") {
		return &ProviderError{
			Code:        "invalid_request",
			Message:     "invalid request",
			UserMessage: "The request was invalid. Please check your input and try again.",
		}
	}

	// Sanitize error message to remove any potential API key exposure
	sanitizedMsg := sanitizeErrorMessage(errStr)

	return &ProviderError{
		Code:        "provider_error",
		Message:     sanitizedMsg,
		UserMessage: "An error occurred communicating with Gemini. Please try again.",
	}
}

// sanitizeErrorMessage removes potential API key patterns from error messages.
func sanitizeErrorMessage(msg string) string {
	// Remove AIza... pattern (Gemini API keys) - may appear multiple times
	for {
		idx := strings.Index(msg, "AIza")
		if idx == -1 {
			break
		}
		end := idx + 4
		for end < len(msg) && (msg[end] >= 'A' && msg[end] <= 'Z' ||
			msg[end] >= 'a' && msg[end] <= 'z' ||
			msg[end] >= '0' && msg[end] <= '9' ||
			msg[end] == '-' || msg[end] == '_') {
			end++
		}
		msg = msg[:idx] + "[REDACTED]" + msg[end:]
	}

	// Also sanitize common parameter patterns that might contain keys
	patterns := []string{"key=AIza", "apiKey=AIza", "api_key=AIza", `"key":"AIza`, `"apiKey":"AIza`}
	for _, pattern := range patterns {
		if strings.Contains(msg, pattern) {
			// Already handled by the AIza removal above, but double-check
			msg = strings.ReplaceAll(msg, pattern, pattern[:strings.Index(pattern, "AIza")]+"[REDACTED]")
		}
	}

	return msg
}
