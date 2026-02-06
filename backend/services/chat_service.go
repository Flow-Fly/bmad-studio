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
	streamTimeout              = 5 * time.Minute
	relayChannelSize           = 64
	defaultMaxTokens           = 8192
	DefaultMaxToolLoopIters    = 200
	conversationTTL            = 1 * time.Hour
	conversationCleanupInterval = 5 * time.Minute
)

// ConversationState holds the accumulated history for a conversation.
type ConversationState struct {
	Messages     []providers.Message
	LastActivity time.Time
	Provider     string
	Model        string
}

// ChatService manages chat streaming sessions between clients and LLM providers.
type ChatService struct {
	providerService  *ProviderService
	hub              *websocket.Hub
	orchestrator     *ToolOrchestrator
	registry         *tools.ToolRegistry
	activeStreams    map[string]context.CancelFunc
	conversations    map[string]*ConversationState
	mu               sync.RWMutex
	convMu           sync.RWMutex // separate mutex for conversations to reduce contention
	maxToolLoopIters int          // configurable for testing; defaults to DefaultMaxToolLoopIters
	cleanupCancel    context.CancelFunc
}

// NewChatService creates a new ChatService.
// Note: cleanupCancel is set without mutex because initialization completes
// before the service is returned (happens-before relationship guarantees safety).
func NewChatService(providerService *ProviderService, hub *websocket.Hub, orchestrator *ToolOrchestrator, registry *tools.ToolRegistry) *ChatService {
	ctx, cancel := context.WithCancel(context.Background())
	cs := &ChatService{
		providerService:  providerService,
		hub:              hub,
		orchestrator:     orchestrator,
		registry:         registry,
		activeStreams:    make(map[string]context.CancelFunc),
		conversations:    make(map[string]*ConversationState),
		maxToolLoopIters: DefaultMaxToolLoopIters,
		cleanupCancel:    cancel,
	}
	go cs.cleanupStaleConversations(ctx)
	return cs
}

// cleanupStaleConversations periodically removes conversations that have been inactive.
func (cs *ChatService) cleanupStaleConversations(ctx context.Context) {
	ticker := time.NewTicker(conversationCleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cs.convMu.Lock()
			now := time.Now()
			for id, conv := range cs.conversations {
				if now.Sub(conv.LastActivity) > conversationTTL {
					delete(cs.conversations, id)
					log.Printf("Chat: cleaned up stale conversation %s (inactive for >%v)", id, conversationTTL)
				}
			}
			cs.convMu.Unlock()
		}
	}
}

// Stop gracefully shuts down the ChatService cleanup goroutine.
func (cs *ChatService) Stop() {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	if cs.cleanupCancel != nil {
		cs.cleanupCancel()
	}
}

// SetMaxToolLoopIters sets the maximum tool loop iterations (for testing).
func (cs *ChatService) SetMaxToolLoopIters(max int) {
	cs.maxToolLoopIters = max
}

// saveConversationMessages replaces the conversation's message history with the provided messages.
// This is called during the tool loop to persist accumulated messages.
func (cs *ChatService) saveConversationMessages(conversationID string, messages []providers.Message) {
	cs.convMu.Lock()
	defer cs.convMu.Unlock()
	if conv, exists := cs.conversations[conversationID]; exists {
		conv.Messages = make([]providers.Message, len(messages))
		copy(conv.Messages, messages)
		conv.LastActivity = time.Now()
	}
}

// SetToolLayer updates the tool execution layer (registry and orchestrator).
// Called when a project is loaded to enable tool execution.
func (cs *ChatService) SetToolLayer(orchestrator *ToolOrchestrator, registry *tools.ToolRegistry) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	cs.orchestrator = orchestrator
	cs.registry = registry
	if registry != nil {
		log.Printf("ChatService: tool layer updated, %d tools available", len(registry.ListForScope(nil)))
	} else {
		log.Printf("ChatService: tool layer cleared")
	}
}

// Orchestrator returns the current tool orchestrator (may be nil).
func (cs *ChatService) Orchestrator() *ToolOrchestrator {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.orchestrator
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
	if payload.APIKey == "" && cs.providerService.RequiresAPIKey(payload.Provider) {
		return fmt.Errorf("api_key is required")
	}

	// Lookup or create conversation state
	cs.convMu.Lock()
	conv, exists := cs.conversations[payload.ConversationID]
	if !exists {
		conv = &ConversationState{
			Messages:     make([]providers.Message, 0),
			Provider:     payload.Provider,
			Model:        payload.Model,
		}
		cs.conversations[payload.ConversationID] = conv
	}

	// Append user message to conversation history
	userMsg := providers.Message{Role: "user", Content: payload.Content}
	conv.Messages = append(conv.Messages, userMsg)

	// Copy messages for request (avoid race with concurrent updates)
	messages := make([]providers.Message, len(conv.Messages))
	copy(messages, conv.Messages)

	// Update LastActivity after all modifications, just before releasing lock
	conv.LastActivity = time.Now()
	cs.convMu.Unlock()

	// Get tool definitions if registry is available
	var toolDefs []types.ToolDefinition
	cs.mu.RLock()
	if cs.registry != nil {
		toolDefs = cs.registry.ListDefinitionsForScope(nil)
	}
	cs.mu.RUnlock()

	// Build system prompt with tool awareness
	systemPrompt := buildSystemPrompt(payload.SystemPrompt, toolDefs)

	req := providers.ChatRequest{
		Messages:     messages,
		Model:        payload.Model,
		MaxTokens:    defaultMaxTokens,
		SystemPrompt: systemPrompt,
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

	go cs.consumeStream(streamCtx, cancel, client, payload.ConversationID, payload.Provider, payload.APIKey, systemPrompt, payload.Model, messages, toolDefs, chunks)

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
			// Relay the final text-only response and save to conversation history
			_, _, finalText, _ := cs.relayStream(ctx, client, conversationID, model, finalChunks)
			if finalText != "" {
				messages = append(messages, providers.Message{Role: "assistant", Content: finalText})
				cs.saveConversationMessages(conversationID, messages)
			}
			return
		}
		iteration++

		toolCalls, messageID, assistantText, done := cs.relayStream(ctx, client, conversationID, model, chunks)

		if done {
			// Stream ended successfully — save assistant message to history
			if assistantText != "" {
				messages = append(messages, providers.Message{Role: "assistant", Content: assistantText})
				cs.saveConversationMessages(conversationID, messages)
			}
			return
		}

		// No tool calls → stream ended normally (already handled in relayStream)
		if len(toolCalls) == 0 {
			if assistantText != "" {
				messages = append(messages, providers.Message{Role: "assistant", Content: assistantText})
				cs.saveConversationMessages(conversationID, messages)
			}
			return
		}

		// Tool calls detected — execute them and loop
		log.Printf("Chat: %d tool call(s) in iteration %d for conversation %s", len(toolCalls), iteration, conversationID)

		// Build assistant message with tool calls (may also include text content)
		assistantToolCalls := make([]types.ToolCall, 0, len(toolCalls))
		for _, acc := range toolCalls {
			fullInput := strings.Join(acc.inputParts, "")
			assistantToolCalls = append(assistantToolCalls, types.ToolCall{
				ID:    acc.toolID,
				Name:  acc.toolName,
				Input: json.RawMessage(fullInput),
			})
		}
		assistantMsg := providers.Message{
			Role:      "assistant",
			Content:   assistantText, // Include any text that preceded tool calls
			ToolCalls: assistantToolCalls,
		}
		messages = append(messages, assistantMsg)

		// Save after assistant message with tool calls
		cs.saveConversationMessages(conversationID, messages)

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
				// TODO: Make trust level configurable per conversation/user
				result, err = cs.orchestrator.HandleToolCall(ctx, client, conversationID, messageID, tc, types.TrustLevelAutonomous)
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

			// Save after each tool result to preserve progress
			cs.saveConversationMessages(conversationID, messages)
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
// accumulated text content, and whether the stream ended cleanly (no pending tool calls).
func (cs *ChatService) relayStream(
	ctx context.Context,
	client *websocket.Client,
	conversationID, model string,
	chunks <-chan providers.StreamChunk,
) (toolCalls []*toolCallAccumulator, messageID string, textContent string, done bool) {

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

	var textParts []string
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
				return pendingCalls, messageID, strings.Join(textParts, ""), len(pendingCalls) == 0
			}

			switch chunk.Type {
			case providers.ChunkTypeStart:
				messageID = chunk.MessageID
				startEvent := types.NewChatStreamStartEvent(conversationID, messageID, model)
				if err := cs.hub.SendToClient(client, startEvent); err != nil {
					log.Printf("Chat: failed to send stream-start: %v", err)
				}

			case providers.ChunkTypeChunk:
				textParts = append(textParts, chunk.Content)
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
				// Broadcast tool-start event for the frontend to create tool block UI
				startEvent := types.NewChatToolStartEvent(conversationID, messageID, chunk.ToolID, chunk.ToolName, map[string]interface{}{})
				cs.hub.SendToClient(client, startEvent)

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
					return pendingCalls, messageID, strings.Join(textParts, ""), false
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
				return nil, messageID, strings.Join(textParts, ""), true

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
				return nil, messageID, strings.Join(textParts, ""), true
			}

		case <-ctx.Done():
			if !ended {
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
				if err := cs.hub.SendToClient(client, endEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
				}
			}
			return nil, messageID, strings.Join(textParts, ""), true
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

// buildSystemPrompt constructs a system prompt that includes tool awareness.
// If tools are available, prepends instructions about using them.
func buildSystemPrompt(userPrompt string, tools []types.ToolDefinition) string {
	if len(tools) == 0 {
		return userPrompt
	}

	// Build tool list
	var toolNames []string
	for _, t := range tools {
		toolNames = append(toolNames, t.Name)
	}

	toolPrompt := fmt.Sprintf(`You have access to the following tools: %s.

Use these tools when appropriate to help the user. For example:
- Use 'bash' to run shell commands like 'ls', 'cat', 'grep', etc.
- Use 'file_read' to read file contents
- Use 'file_write' to create or modify files
- Use 'web_search' to search the internet for information

When the user asks you to perform tasks that require these capabilities, use the appropriate tool rather than saying you cannot do it.`, strings.Join(toolNames, ", "))

	if userPrompt == "" {
		return toolPrompt
	}
	return toolPrompt + "\n\n" + userPrompt
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
