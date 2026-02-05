package providers

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"bmad-studio/backend/types"
)

// OllamaProvider implements the Provider interface for local Ollama instances.
type OllamaProvider struct {
	baseURL    string
	httpClient *http.Client
}

// NewOllamaProvider creates a new OllamaProvider with the given endpoint URL.
// If endpoint is empty, defaults to http://localhost:11434.
func NewOllamaProvider(endpoint string) *OllamaProvider {
	if endpoint == "" {
		endpoint = "http://localhost:11434"
	}
	return &OllamaProvider{
		baseURL:    endpoint,
		httpClient: &http.Client{},
	}
}

// ollamaTagsResponse is the response from GET /api/tags.
type ollamaTagsResponse struct {
	Models []ollamaModelInfo `json:"models"`
}

// ollamaModelInfo represents a single model from the Ollama tags endpoint.
type ollamaModelInfo struct {
	Name       string `json:"name"`
	Model      string `json:"model"`
	ModifiedAt string `json:"modified_at"`
	Size       int64  `json:"size"`
}

// fetchTags calls GET /api/tags and returns the parsed response.
func (p *OllamaProvider) fetchTags(ctx context.Context) (*ollamaTagsResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", p.baseURL+"/api/tags", nil)
	if err != nil {
		return nil, mapOllamaProviderError(err, 0)
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, mapOllamaProviderError(err, 0)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, mapOllamaProviderError(nil, resp.StatusCode)
	}

	var tagsResp ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&tagsResp); err != nil {
		return nil, &ProviderError{
			Code:        "provider_error",
			Message:     "failed to parse model list",
			UserMessage: "Failed to parse Ollama model list. Please check your Ollama installation.",
		}
	}
	return &tagsResp, nil
}

// ValidateCredentials checks if Ollama is reachable by calling GET /api/tags.
func (p *OllamaProvider) ValidateCredentials(ctx context.Context) error {
	_, err := p.fetchTags(ctx)
	return err
}

// ListModels returns models dynamically fetched from the local Ollama instance.
func (p *OllamaProvider) ListModels() ([]Model, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tagsResp, err := p.fetchTags(ctx)
	if err != nil {
		return nil, err
	}

	models := make([]Model, 0, len(tagsResp.Models))
	for _, m := range tagsResp.Models {
		models = append(models, Model{
			ID:       m.Name,
			Name:     m.Name,
			Provider: "ollama",
		})
	}
	return models, nil
}

// ollamaChatRequest is the request body for POST /api/chat.
type ollamaChatRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Stream   bool            `json:"stream"`
	Tools    []ollamaTool    `json:"tools,omitempty"`
}

// ollamaTool represents a tool definition in the Ollama API.
type ollamaTool struct {
	Type     string             `json:"type"`
	Function ollamaToolFunction `json:"function"`
}

// ollamaToolFunction describes a function tool for Ollama.
type ollamaToolFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

// ollamaChatResponse is a single NDJSON line from the streaming chat response.
type ollamaChatResponse struct {
	Model              string        `json:"model"`
	CreatedAt          string        `json:"created_at"`
	Message            ollamaMessage `json:"message"`
	Done               bool          `json:"done"`
	DoneReason         string        `json:"done_reason,omitempty"`
	TotalDuration      int64         `json:"total_duration,omitempty"`
	LoadDuration       int64         `json:"load_duration,omitempty"`
	PromptEvalCount    int           `json:"prompt_eval_count,omitempty"`
	PromptEvalDuration int64         `json:"prompt_eval_duration,omitempty"`
	EvalCount          int           `json:"eval_count,omitempty"`
	EvalDuration       int64         `json:"eval_duration,omitempty"`
}

// ollamaMessage represents a message in the Ollama chat API.
type ollamaMessage struct {
	Role      string           `json:"role"`
	Content   string           `json:"content"`
	ToolCalls []ollamaToolCall `json:"tool_calls,omitempty"`
}

// ollamaToolCall represents a tool call in an Ollama response.
type ollamaToolCall struct {
	Function ollamaToolCallFunction `json:"function"`
}

// ollamaToolCallFunction describes the function invocation in a tool call.
type ollamaToolCallFunction struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// SendMessage sends a chat request to Ollama and returns a channel streaming response chunks.
func (p *OllamaProvider) SendMessage(ctx context.Context, req ChatRequest) (<-chan StreamChunk, error) {
	messages := make([]ollamaMessage, 0, len(req.Messages)+1)

	if req.SystemPrompt != "" {
		messages = append(messages, ollamaMessage{
			Role:    "system",
			Content: req.SystemPrompt,
		})
	}

	for _, msg := range req.Messages {
		switch msg.Role {
		case "user":
			messages = append(messages, ollamaMessage{
				Role:    msg.Role,
				Content: msg.Content,
			})
		case "assistant":
			ollamaMsg := ollamaMessage{
				Role:    msg.Role,
				Content: msg.Content,
			}
			// Include tool calls if present (for multi-turn tool use)
			if len(msg.ToolCalls) > 0 {
				ollamaMsg.ToolCalls = make([]ollamaToolCall, 0, len(msg.ToolCalls))
				for _, tc := range msg.ToolCalls {
					ollamaMsg.ToolCalls = append(ollamaMsg.ToolCalls, ollamaToolCall{
						Function: ollamaToolCallFunction{
							Name:      tc.Name,
							Arguments: tc.Input,
						},
					})
				}
			}
			messages = append(messages, ollamaMsg)
		case "tool":
			messages = append(messages, ollamaMessage{
				Role:    "tool",
				Content: msg.Content,
			})
		default:
			return nil, &ProviderError{
				Code:        "invalid_role",
				Message:     fmt.Sprintf("unsupported message role: %s", msg.Role),
				UserMessage: fmt.Sprintf("Unsupported message role: %s. Use 'user', 'assistant', or 'tool'.", msg.Role),
			}
		}
	}

	chatReq := ollamaChatRequest{
		Model:    req.Model,
		Messages: messages,
		Stream:   true,
	}

	// Convert tool definitions to Ollama format
	if len(req.Tools) > 0 {
		chatReq.Tools = buildOllamaTools(req.Tools)
	}

	body, err := json.Marshal(chatReq)
	if err != nil {
		return nil, &ProviderError{
			Code:        "invalid_request",
			Message:     "failed to marshal request",
			UserMessage: "Failed to prepare the request. Please try again.",
		}
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, mapOllamaProviderError(err, 0)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, mapOllamaProviderError(err, 0)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, mapOllamaProviderError(nil, resp.StatusCode)
	}

	messageID := generateOllamaMessageID()
	ch := make(chan StreamChunk, 32)

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		chunkIndex := 0
		ended := false
		toolCallCounter := 0

		send := func(chunk StreamChunk) bool {
			select {
			case ch <- chunk:
				return true
			case <-ctx.Done():
				return false
			}
		}

		if !send(StreamChunk{
			Type:      ChunkTypeStart,
			MessageID: messageID,
		}) {
			return
		}

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}

			var chatResp ollamaChatResponse
			if err := json.Unmarshal(line, &chatResp); err != nil {
				continue
			}

			// Check for tool calls (Ollama sends them in a single response, not streamed incrementally)
			if len(chatResp.Message.ToolCalls) > 0 {
				for _, tc := range chatResp.Message.ToolCalls {
					toolCallCounter++
					toolID := fmt.Sprintf("ollama_tool_%d_%s", toolCallCounter, messageID[:8])

					// Emit tool_call_start
					if !send(StreamChunk{
						Type:      ChunkTypeToolCallStart,
						ToolID:    toolID,
						ToolName:  tc.Function.Name,
						MessageID: messageID,
					}) {
						return
					}

					// Emit single tool_call_delta with full input JSON
					if !send(StreamChunk{
						Type:      ChunkTypeToolCallDelta,
						ToolID:    toolID,
						Content:   string(tc.Function.Arguments),
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
				continue
			}

			if chatResp.Done {
				ended = true
				send(StreamChunk{
					Type:      ChunkTypeEnd,
					MessageID: messageID,
					Usage: &UsageStats{
						InputTokens:  chatResp.PromptEvalCount,
						OutputTokens: chatResp.EvalCount,
					},
				})
				break
			}

			if chatResp.Message.Content != "" {
				if !send(StreamChunk{
					Type:      ChunkTypeChunk,
					Content:   chatResp.Message.Content,
					MessageID: messageID,
					Index:     chunkIndex,
				}) {
					return
				}
				chunkIndex++
			}
		}

		if err := scanner.Err(); err != nil && !ended {
			providerErr := mapOllamaProviderError(err, 0)
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

// buildOllamaTools converts ToolDefinitions to Ollama tool format.
func buildOllamaTools(defs []types.ToolDefinition) []ollamaTool {
	tools := make([]ollamaTool, 0, len(defs))
	for _, td := range defs {
		tools = append(tools, ollamaTool{
			Type: "function",
			Function: ollamaToolFunction{
				Name:        td.Name,
				Description: td.Description,
				Parameters:  td.InputSchema,
			},
		})
	}
	return tools
}

// generateOllamaMessageID generates a unique message ID for Ollama responses.
func generateOllamaMessageID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("ollama_%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("ollama_%x", b)
}

// mapOllamaProviderError converts Ollama errors to user-friendly ProviderError values.
func mapOllamaProviderError(err error, statusCode int) *ProviderError {
	if err != nil {
		if isTimeout(err) {
			return &ProviderError{
				Code:        "timeout",
				Message:     err.Error(),
				UserMessage: "Connection to Ollama timed out. Please check if Ollama is running.",
			}
		}
		if isConnectionRefused(err) {
			return &ProviderError{
				Code:        "connection_error",
				Message:     err.Error(),
				UserMessage: "Cannot connect to Ollama. Please ensure Ollama is running (ollama serve) and accessible.",
			}
		}
		return &ProviderError{
			Code:        "connection_error",
			Message:     err.Error(),
			UserMessage: "Failed to connect to Ollama. Please check your Ollama endpoint configuration.",
		}
	}

	switch statusCode {
	case 404:
		return &ProviderError{
			Code:        "model_not_found",
			Message:     "model not found",
			UserMessage: "The requested model was not found. Please pull the model first (ollama pull <model>).",
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
			Message:     fmt.Sprintf("Ollama error (status %d)", statusCode),
			UserMessage: "An error occurred communicating with Ollama. Please try again.",
		}
	}
}

func isTimeout(err error) bool {
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout()
	}
	return false
}

func isConnectionRefused(err error) bool {
	var opErr *net.OpError
	if errors.As(err, &opErr) {
		return strings.Contains(opErr.Err.Error(), "connection refused")
	}
	return strings.Contains(err.Error(), "connection refused")
}
