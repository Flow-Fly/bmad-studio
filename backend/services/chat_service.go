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
	defaultMaxTokens = 8192
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
		MaxTokens:    defaultMaxTokens,
		SystemPrompt: payload.SystemPrompt,
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
				// Drain remaining chunks to prevent provider goroutine from blocking
				for range chunks {
				}
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
					if err := cs.hub.SendToClient(client, endEvent); err != nil {
						log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
					}
				}
				return
			}

			switch chunk.Type {
			case "start":
				messageID = chunk.MessageID
				startEvent := types.NewChatStreamStartEvent(conversationID, messageID, model)
				if err := cs.hub.SendToClient(client, startEvent); err != nil {
					log.Printf("Chat: failed to send stream-start: %v", err)
				}

			case "chunk":
				deltaEvent := types.NewChatTextDeltaEvent(conversationID, messageID, chunk.Content, textIndex)
				if err := cs.hub.SendToClient(client, deltaEvent); err != nil {
					log.Printf("Chat: failed to send text-delta: %v", err)
				}
				textIndex++

			case "thinking":
				thinkingEvent := types.NewChatThinkingDeltaEvent(conversationID, messageID, chunk.Content, thinkingIndex)
				if err := cs.hub.SendToClient(client, thinkingEvent); err != nil {
					log.Printf("Chat: failed to send thinking-delta: %v", err)
				}
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
				if err := cs.hub.SendToClient(client, endEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
				}

			case "error":
				ended = true
				errorEvent := types.NewChatErrorEvent(conversationID, messageID, "provider_error", chunk.Content)
				if err := cs.hub.SendToClient(client, errorEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send error event: %v", err)
				}
				// Always send stream-end after error so frontend exits streaming state
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
				if err := cs.hub.SendToClient(client, endEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
				}
			}

		case <-ctx.Done():
			// Context cancelled (timeout or user cancel)
			if !ended {
				endEvent := types.NewChatStreamEndEvent(conversationID, messageID, nil, true)
				if err := cs.hub.SendToClient(client, endEvent); err != nil {
					log.Printf("Chat: CRITICAL failed to send stream-end: %v", err)
				}
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
