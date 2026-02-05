package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/providers"
	"bmad-studio/backend/tools"
	"bmad-studio/backend/types"
)

const (
	streamTimeout           = 5 * time.Minute
	relayChannelSize        = 64
	defaultMaxTokens        = 8192
	DefaultMaxToolLoopIters = 200
)

// ChatService manages chat streaming sessions between clients and LLM providers.
type ChatService struct {
	providerService  *ProviderService
	hub              *websocket.Hub
	orchestrator     *ToolOrchestrator
	registry         *tools.ToolRegistry
	activeStreams    map[string]context.CancelFunc
	mu               sync.RWMutex
	maxToolLoopIters int // configurable for testing; defaults to DefaultMaxToolLoopIters
}

// NewChatService creates a new ChatService.
func NewChatService(providerService *ProviderService, hub *websocket.Hub, orchestrator *ToolOrchestrator, registry *tools.ToolRegistry) *ChatService {
	return &ChatService{
		providerService:  providerService,
		hub:              hub,
		orchestrator:     orchestrator,
		registry:         registry,
		activeStreams:    make(map[string]context.CancelFunc),
		maxToolLoopIters: DefaultMaxToolLoopIters,
	}
}

// SetMaxToolLoopIters sets the maximum tool loop iterations (for testing).
func (cs *ChatService) SetMaxToolLoopIters(max int) {
	cs.maxToolLoopIters = max
}

// HandleMessage processes an incoming chat:send message from a client.
func (cs *ChatService) HandleMessage(ctx context.Context, client *websocket.Client, payload types.ChatSendPayload) error {
	if payload.ConversationID == "" {
		return fmt.Errorf("conversation_id is required")
	}
	if payload.Content == "" {
		return fmt.Errorf("content is required")
	}
	if payload.Provider == "" {
		return fmt.Errorf("provider is required")
	}
	if payload.Model == "" {
		return fmt.Errorf("model is required")
	}
	if payload.APIKey == "" {
		return fmt.Errorf("api_key is required")
	}

	// Build messages from history + current user message
	messages := convertHistory(payload.History)
	messages = append(messages, providers.Message{Role: "user", Content: payload.Content})

	// Get tool definitions if registry is available
	var toolDefs []types.ToolDefinition
	if cs.registry != nil {
		toolDefs = cs.registry.ListDefinitionsForScope(nil)
	}

	req := providers.ChatRequest{
		Messages:     messages,
		Model:        payload.Model,
		MaxTokens:    defaultMaxTokens,
		SystemPrompt: payload.SystemPrompt,
		Tools:        toolDefs,
	}

	streamCtx, cancel := context.WithTimeout(ctx, streamTimeout)

	cs.mu.Lock()
	existingCancel, hadExisting := cs.activeStreams[payload.ConversationID]
	cs.activeStreams[payload.ConversationID] = cancel
	cs.mu.Unlock()

	if hadExisting {
		existingCancel()
	}

	chunks, err := cs.providerService.SendMessage(streamCtx, payload.Provider, payload.APIKey, req)
	if err != nil {
		cancel()
		cs.removeStream(payload.ConversationID)
		return err
	}

	go cs.consumeStream(streamCtx, cancel, client, payload.ConversationID, payload.Provider, payload.APIKey, payload.SystemPrompt, payload.Model, messages, toolDefs, chunks)

	return nil
}

// toolCallAccumulator collects streaming tool call chunks.
type toolCallAccumulator struct {
	toolID    string
	toolName  string
	inputParts []string
}

// consumeStream reads from the provider channel and relays events to the client.
// Implements the tool call loop: when tool calls are detected, it executes them
// and re-invokes the provider with the results.
func (cs *ChatService) consumeStream(
	ctx context.Context,
	cancel context.CancelFunc,
	client *websocket.Client,
	conversationID, providerType, apiKey, systemPrompt, model string,
	messages []providers.Message,
	toolDefs []types.ToolDefinition,
	chunks <-chan providers.StreamChunk,
) {
	defer func() {
		cancel()
		cs.removeStream(conversationID)
	}()

	iteration := 0

	for {
		if iteration >= cs.maxToolLoopIters {
			log.Printf("Chat: tool loop safety max reached (%d iterations) for conversation %s", cs.maxToolLoopIters, conversationID)
			// Force a text-only response by removing tools and making one final call
			req := providers.ChatRequest{
				Messages:     messages,
				Model:        model,
				MaxTokens:    defaultMaxTokens,
				SystemPrompt: systemPrompt,
				// Tools omitted to force text response
			}
			finalChunks, err := cs.providerService.SendMessage(ctx, providerType, apiKey, req)
			if err != nil {
				log.Printf("Chat: failed to get final text response after max iterations: %v", err)
				endEvent := types.NewChatStreamEndEvent(conversationID, "", nil, true)
				cs.hub.SendToClient(client, endEvent)
				return
			}
			// Relay the final text-only response
			_, _, _ = cs.relayStream(ctx, client, conversationID, model, finalChunks)
			return
		}
		iteration++

		toolCalls, messageID, done := cs.relayStream(ctx, client, conversationID, model, chunks)

		if done {
			return
		}

		// No tool calls → stream ended normally (already handled in relayStream)
		if len(toolCalls) == 0 {
			return
		}

		// Tool calls detected — execute them and loop
		log.Printf("Chat: %d tool call(s) in iteration %d for conversation %s", len(toolCalls), iteration, conversationID)

		// Build assistant message with tool calls
		assistantToolCalls := make([]types.ToolCall, 0, len(toolCalls))
		for _, acc := range toolCalls {
			fullInput := strings.Join(acc.inputParts, "")
			assistantToolCalls = append(assistantToolCalls, types.ToolCall{
				ID:    acc.toolID,
				Name:  acc.toolName,
				Input: json.RawMessage(fullInput),
			})
		}
		messages = append(messages, providers.Message{
			Role:      "assistant",
			ToolCalls: assistantToolCalls,
		})

		// Execute each tool call and append results
		for _, tc := range assistantToolCalls {
			if ctx.Err() != nil {
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
				cs.hub.SendToClient(client, endEvent)
				return
			}

			var result *tools.ToolResult
			if cs.orchestrator != nil {
				var err error
				result, err = cs.orchestrator.HandleToolCall(ctx, client, conversationID, messageID, tc, types.TrustLevelGuided)
				if err != nil {
					// System error — inject error message and continue
					result = &tools.ToolResult{
						Output:  fmt.Sprintf("tool execution error: %v", err),
						IsError: true,
					}
				}
			} else {
				result = &tools.ToolResult{
					Output:  "tool execution not available",
					IsError: true,
				}
			}

			messages = append(messages, providers.Message{
				Role:       "tool",
				ToolCallID: tc.ID,
				ToolName:   tc.Name,
				Content:    result.Output,
			})
		}

		// Re-invoke provider with updated messages
		req := providers.ChatRequest{
			Messages:     messages,
			Model:        model,
			MaxTokens:    defaultMaxTokens,
			SystemPrompt: systemPrompt,
			Tools:        toolDefs,
		}

		var err error
		chunks, err = cs.providerService.SendMessage(ctx, providerType, apiKey, req)
		if err != nil {
			log.Printf("Chat: failed to re-invoke provider in tool loop: %v", err)
			errorEvent := types.NewChatErrorEvent(conversationID, messageID, "provider_error", err.Error())
			cs.hub.SendToClient(client, errorEvent)
			endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
			cs.hub.SendToClient(client, endEvent)
			return
		}
	}
}

// relayStream reads from a provider chunk channel, relays text/thinking events,
// and accumulates tool call chunks. Returns the collected tool calls, last messageID,
// and whether the stream ended cleanly (no pending tool calls).
func (cs *ChatService) relayStream(
	ctx context.Context,
	client *websocket.Client,
	conversationID, model string,
	chunks <-chan providers.StreamChunk,
) (toolCalls []*toolCallAccumulator, messageID string, done bool) {

	relay := make(chan providers.StreamChunk, relayChannelSize)

	// Producer: read from provider channel into relay buffer
	go func() {
		defer close(relay)
		for chunk := range chunks {
			select {
			case relay <- chunk:
			case <-ctx.Done():
				for range chunks {
				}
				return
			}
		}
	}()

	textIndex := 0
	thinkingIndex := 0
	ended := false
	accumulators := make(map[string]*toolCallAccumulator)

	for {
		select {
		case chunk, ok := <-relay:
			if !ok {
				// Channel closed
				if !ended {
					endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, false)
					if err := cs.hub.SendToClient(client, endEvent); err != nil {
						log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
					}
				}
				// Return any pending tool calls
				var pendingCalls []*toolCallAccumulator
				for _, acc := range accumulators {
					pendingCalls = append(pendingCalls, acc)
				}
				return pendingCalls, messageID, len(pendingCalls) == 0
			}

			switch chunk.Type {
			case providers.ChunkTypeStart:
				messageID = chunk.MessageID
				startEvent := types.NewChatStreamStartEvent(conversationID, messageID, model)
				if err := cs.hub.SendToClient(client, startEvent); err != nil {
					log.Printf("Chat: failed to send stream-start: %v", err)
				}

			case providers.ChunkTypeChunk:
				deltaEvent := types.NewChatTextDeltaEvent(conversationID, messageID, chunk.Content, textIndex)
				if err := cs.hub.SendToClient(client, deltaEvent); err != nil {
					log.Printf("Chat: failed to send text-delta: %v", err)
				}
				textIndex++

			case providers.ChunkTypeThinking:
				thinkingEvent := types.NewChatThinkingDeltaEvent(conversationID, messageID, chunk.Content, thinkingIndex)
				if err := cs.hub.SendToClient(client, thinkingEvent); err != nil {
					log.Printf("Chat: failed to send thinking-delta: %v", err)
				}
				thinkingIndex++

			case providers.ChunkTypeToolCallStart:
				accumulators[chunk.ToolID] = &toolCallAccumulator{
					toolID:   chunk.ToolID,
					toolName: chunk.ToolName,
				}
				// Broadcast tool delta event for the frontend
				deltaEvent := types.NewChatToolDeltaEvent(conversationID, messageID, chunk.ToolID, "")
				cs.hub.SendToClient(client, deltaEvent)

			case providers.ChunkTypeToolCallDelta:
				if acc, ok := accumulators[chunk.ToolID]; ok {
					acc.inputParts = append(acc.inputParts, chunk.Content)
				}
				deltaEvent := types.NewChatToolDeltaEvent(conversationID, messageID, chunk.ToolID, chunk.Content)
				cs.hub.SendToClient(client, deltaEvent)

			case providers.ChunkTypeToolCallEnd:
				// Tool call complete — will be executed after stream ends

			case providers.ChunkTypeEnd:
				ended = true
				if len(accumulators) > 0 {
					// Tool calls pending — don't send stream-end yet, return for execution
					var pendingCalls []*toolCallAccumulator
					for _, acc := range accumulators {
						pendingCalls = append(pendingCalls, acc)
					}
					return pendingCalls, messageID, false
				}
				// No tool calls — normal end
				var usage *types.UsageStats
				if chunk.Usage != nil {
					usage = &types.UsageStats{
						InputTokens:  chunk.Usage.InputTokens,
						OutputTokens: chunk.Usage.OutputTokens,
					}
				}
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, usage, false)
				if err := cs.hub.SendToClient(client, endEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
				}
				return nil, messageID, true

			case providers.ChunkTypeError:
				ended = true
				errorEvent := types.NewChatErrorEvent(conversationID, messageID, "provider_error", chunk.Content)
				if err := cs.hub.SendToClient(client, errorEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send error event: %v", err)
				}
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
				if err := cs.hub.SendToClient(client, endEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
				}
				return nil, messageID, true
			}

		case <-ctx.Done():
			if !ended {
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
				if err := cs.hub.SendToClient(client, endEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
				}
			}
			return nil, messageID, true
		}
	}
}

// convertHistory converts ChatMessage history to providers.Message format.
func convertHistory(history []types.ChatMessage) []providers.Message {
	if len(history) == 0 {
		return nil
	}
	messages := make([]providers.Message, 0, len(history))
	for _, h := range history {
		msg := providers.Message{
			Role:       h.Role,
			Content:    h.Content,
			ToolCallID: h.ToolCallID,
			ToolName:   h.ToolName,
		}
		if len(h.ToolCalls) > 0 {
			msg.ToolCalls = h.ToolCalls
		}
		messages = append(messages, msg)
	}
	return messages
}

// CancelStream cancels an active streaming session.
func (cs *ChatService) CancelStream(conversationID string) error {
	cs.mu.RLock()
	cancel, ok := cs.activeStreams[conversationID]
	cs.mu.RUnlock()

	if !ok {
		return fmt.Errorf("no active stream for conversation %s", conversationID)
	}

	cancel()
	return nil
}

// ActiveStreamCount returns the number of currently active streams.
func (cs *ChatService) ActiveStreamCount() int {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return len(cs.activeStreams)
}

func (cs *ChatService) removeStream(conversationID string) {
	cs.mu.Lock()
	delete(cs.activeStreams, conversationID)
	cs.mu.Unlock()
	log.Printf("Stream ended for conversation %s. Active streams: %d", conversationID, cs.ActiveStreamCount())
}
