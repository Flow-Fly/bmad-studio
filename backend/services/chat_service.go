package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/providers"
	"bmad-studio/backend/types"
)

const (
	streamTimeout    = 5 * time.Minute
	relayChannelSize = 64
)

// ChatService manages chat streaming sessions between clients and LLM providers.
type ChatService struct {
	providerService *ProviderService
	hub             *websocket.Hub
	activeStreams    map[string]context.CancelFunc
	mu              sync.RWMutex
}

// NewChatService creates a new ChatService.
func NewChatService(providerService *ProviderService, hub *websocket.Hub) *ChatService {
	return &ChatService{
		providerService: providerService,
		hub:             hub,
		activeStreams:    make(map[string]context.CancelFunc),
	}
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

	req := providers.ChatRequest{
		Messages: []providers.Message{
			{Role: "user", Content: payload.Content},
		},
		Model:        payload.Model,
		MaxTokens:    8192,
		SystemPrompt: payload.SystemPrompt,
	}

	streamCtx, cancel := context.WithTimeout(ctx, streamTimeout)

	cs.mu.Lock()
	cs.activeStreams[payload.ConversationID] = cancel
	cs.mu.Unlock()

	chunks, err := cs.providerService.SendMessage(streamCtx, payload.Provider, payload.APIKey, req)
	if err != nil {
		cancel()
		cs.removeStream(payload.ConversationID)
		return err
	}

	go cs.consumeStream(streamCtx, cancel, client, payload.ConversationID, payload.Model, chunks)

	return nil
}

// consumeStream reads from the provider channel and relays events to the client.
func (cs *ChatService) consumeStream(ctx context.Context, cancel context.CancelFunc, client *websocket.Client, conversationID, model string, chunks <-chan providers.StreamChunk) {
	defer func() {
		cancel()
		cs.removeStream(conversationID)
	}()

	relay := make(chan providers.StreamChunk, relayChannelSize)

	// Producer: read from provider channel into relay buffer
	go func() {
		defer close(relay)
		for chunk := range chunks {
			select {
			case relay <- chunk:
			case <-ctx.Done():
				return
			}
		}
	}()

	var messageID string
	textIndex := 0
	thinkingIndex := 0
	ended := false

	for {
		select {
		case chunk, ok := <-relay:
			if !ok {
				// Channel closed — if no end event was sent, emit one
				if !ended {
					endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, false)
					cs.hub.SendToClient(client, endEvent)
				}
				return
			}

			switch chunk.Type {
			case "start":
				messageID = chunk.MessageID
				startEvent := types.NewChatStreamStartEvent(conversationID, messageID, model)
				cs.hub.SendToClient(client, startEvent)

			case "chunk":
				deltaEvent := types.NewChatTextDeltaEvent(conversationID, messageID, chunk.Content, textIndex)
				cs.hub.SendToClient(client, deltaEvent)
				textIndex++

			case "thinking":
				thinkingEvent := types.NewChatThinkingDeltaEvent(conversationID, messageID, chunk.Content, thinkingIndex)
				cs.hub.SendToClient(client, thinkingEvent)
				thinkingIndex++

			case "end":
				ended = true
				var usage *types.UsageStats
				if chunk.Usage != nil {
					usage = &types.UsageStats{
						InputTokens:  chunk.Usage.InputTokens,
						OutputTokens: chunk.Usage.OutputTokens,
					}
				}
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, usage, false)
				cs.hub.SendToClient(client, endEvent)

			case "error":
				ended = true
				errorEvent := types.NewChatErrorEvent(conversationID, messageID, "provider_error", chunk.Content)
				cs.hub.SendToClient(client, errorEvent)
			}

		case <-ctx.Done():
			// Context cancelled (timeout or user cancel)
			if !ended {
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
				cs.hub.SendToClient(client, endEvent)
			}
			return
		}
	}
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
