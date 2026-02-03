package services

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/providers"
	"bmad-studio/backend/types"
)

// mockClient creates a Client with a buffered send channel for testing.
func mockClient(hub *websocket.Hub) *websocket.Client {
	return websocket.NewClient(hub, nil)
}

// collectEvents reads events from a client's send channel until timeout.
func collectEvents(client *websocket.Client, timeout time.Duration) []*types.WebSocketEvent {
	var events []*types.WebSocketEvent
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case data, ok := <-client.SendChan():
			if !ok {
				return events
			}
			var event types.WebSocketEvent
			if err := json.Unmarshal(data, &event); err == nil {
				events = append(events, &event)
			}
		case <-timer.C:
			return events
		}
	}
}

func TestNewChatService(t *testing.T) {
	hub := websocket.NewHub()
	ps := NewProviderService()
	cs := NewChatService(ps, hub)

	if cs == nil {
		t.Fatal("expected ChatService to be created")
	}
	if cs.ActiveStreamCount() != 0 {
		t.Errorf("expected 0 active streams, got %d", cs.ActiveStreamCount())
	}
}

func TestChatService_HandleMessage_MissingFields(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub)
	client := mockClient(hub)

	tests := []struct {
		name    string
		payload types.ChatSendPayload
	}{
		{"missing conversation_id", types.ChatSendPayload{Content: "hi", Provider: "claude", Model: "claude-sonnet-4-5-20250929", APIKey: "key"}},
		{"missing content", types.ChatSendPayload{ConversationID: "conv-1", Provider: "claude", Model: "claude-sonnet-4-5-20250929", APIKey: "key"}},
		{"missing provider", types.ChatSendPayload{ConversationID: "conv-1", Content: "hi", Model: "claude-sonnet-4-5-20250929", APIKey: "key"}},
		{"missing model", types.ChatSendPayload{ConversationID: "conv-1", Content: "hi", Provider: "claude", APIKey: "key"}},
		{"missing api_key", types.ChatSendPayload{ConversationID: "conv-1", Content: "hi", Provider: "claude", Model: "claude-sonnet-4-5-20250929"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := cs.HandleMessage(context.Background(), client, tt.payload)
			if err == nil {
				t.Error("expected error for missing field")
			}
		})
	}
}

func TestChatService_HandleMessage_InvalidProvider(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub)
	client := mockClient(hub)

	payload := types.ChatSendPayload{
		ConversationID: "conv-1",
		Content:        "hi",
		Provider:       "nonexistent",
		Model:          "some-model",
		APIKey:         "some-key",
	}

	err := cs.HandleMessage(context.Background(), client, payload)
	if err == nil {
		t.Error("expected error for invalid provider")
	}
}

func TestChatService_CancelStream_NoActiveStream(t *testing.T) {
	hub := websocket.NewHub()
	ps := NewProviderService()
	cs := NewChatService(ps, hub)

	err := cs.CancelStream("nonexistent-conv")
	if err == nil {
		t.Error("expected error when cancelling non-existent stream")
	}
}

func TestChatService_ActiveStreamCount(t *testing.T) {
	hub := websocket.NewHub()
	ps := NewProviderService()
	cs := NewChatService(ps, hub)

	if cs.ActiveStreamCount() != 0 {
		t.Errorf("expected 0, got %d", cs.ActiveStreamCount())
	}

	// Manually add a stream entry for testing
	cs.mu.Lock()
	cs.activeStreams["test-conv"] = func() {}
	cs.mu.Unlock()

	if cs.ActiveStreamCount() != 1 {
		t.Errorf("expected 1, got %d", cs.ActiveStreamCount())
	}
}

func TestChatService_CancelStream_Success(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub)

	cancelled := false
	var mu sync.Mutex

	// Manually add a cancel func
	cs.mu.Lock()
	cs.activeStreams["conv-1"] = func() {
		mu.Lock()
		cancelled = true
		mu.Unlock()
	}
	cs.mu.Unlock()

	err := cs.CancelStream("conv-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if !cancelled {
		t.Error("expected cancel function to be called")
	}
}

func TestChatService_ConsumeStream_MapsChunkTypes(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	client := mockClient(hub)
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub)

	// Create a mock chunk channel
	chunks := make(chan providers.StreamChunk, 10)
	chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-1", Model: "claude-sonnet"}
	chunks <- providers.StreamChunk{Type: "thinking", Content: "Let me think", MessageID: "msg-1", Index: 0}
	chunks <- providers.StreamChunk{Type: "chunk", Content: "Hello", MessageID: "msg-1", Index: 1}
	chunks <- providers.StreamChunk{Type: "chunk", Content: " world", MessageID: "msg-1", Index: 2}
	chunks <- providers.StreamChunk{Type: "end", MessageID: "msg-1", Usage: &providers.UsageStats{InputTokens: 10, OutputTokens: 20}}
	close(chunks)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	cs.consumeStream(ctx, cancel, client, "conv-1", "claude-sonnet", chunks)

	events := collectEvents(client, 200*time.Millisecond)

	if len(events) < 5 {
		t.Fatalf("expected at least 5 events, got %d", len(events))
	}

	// Verify event types in order
	expectedTypes := []string{
		types.EventTypeChatStreamStart,
		types.EventTypeChatThinkingDelta,
		types.EventTypeChatTextDelta,
		types.EventTypeChatTextDelta,
		types.EventTypeChatStreamEnd,
	}

	for i, expected := range expectedTypes {
		if i >= len(events) {
			t.Errorf("missing event at index %d: expected %s", i, expected)
			continue
		}
		if events[i].Type != expected {
			t.Errorf("event[%d]: expected type %q, got %q", i, expected, events[i].Type)
		}
	}
}

func TestChatService_ConsumeStream_ContextCancellation(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	client := mockClient(hub)
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub)

	// Create a slow chunk channel that won't close on its own
	chunks := make(chan providers.StreamChunk, 10)
	chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-1", Model: "claude-sonnet"}

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		cs.consumeStream(ctx, cancel, client, "conv-cancel", "claude-sonnet", chunks)
		close(done)
	}()

	// Cancel context after start event is consumed
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case <-done:
		// Expected: consumeStream returned
	case <-time.After(2 * time.Second):
		t.Error("timeout: consumeStream did not return after context cancellation")
	}

	events := collectEvents(client, 200*time.Millisecond)

	// Should have at least a stream-start and a partial stream-end
	hasStart := false
	hasPartialEnd := false
	for _, event := range events {
		if event.Type == types.EventTypeChatStreamStart {
			hasStart = true
		}
		if event.Type == types.EventTypeChatStreamEnd {
			hasPartialEnd = true
		}
	}

	if !hasStart {
		t.Error("expected chat:stream-start event")
	}
	if !hasPartialEnd {
		t.Error("expected partial chat:stream-end event after cancellation")
	}
}

func TestChatService_ConsumeStream_ErrorChunk(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	client := mockClient(hub)
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub)

	chunks := make(chan providers.StreamChunk, 10)
	chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-1", Model: "claude-sonnet"}
	chunks <- providers.StreamChunk{Type: "error", Content: "Something went wrong", MessageID: "msg-1"}
	close(chunks)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	cs.consumeStream(ctx, cancel, client, "conv-err", "claude-sonnet", chunks)

	events := collectEvents(client, 200*time.Millisecond)

	hasError := false
	for _, event := range events {
		if event.Type == types.EventTypeChatError {
			hasError = true
		}
	}

	if !hasError {
		t.Error("expected chat:error event")
	}
}
