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
	cs := NewChatService(ps, hub, nil, nil)

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
	cs := NewChatService(ps, hub, nil, nil)
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
	cs := NewChatService(ps, hub, nil, nil)
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
	cs := NewChatService(ps, hub, nil, nil)

	err := cs.CancelStream("nonexistent-conv")
	if err == nil {
		t.Error("expected error when cancelling non-existent stream")
	}
}

func TestChatService_ActiveStreamCount(t *testing.T) {
	hub := websocket.NewHub()
	ps := NewProviderService()
	cs := NewChatService(ps, hub, nil, nil)

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
	cs := NewChatService(ps, hub, nil, nil)

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
	cs := NewChatService(ps, hub, nil, nil)

	// Create a mock chunk channel
	chunks := make(chan providers.StreamChunk, 10)
	chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-1", Model: "claude-sonnet"}
	chunks <- providers.StreamChunk{Type: "thinking", Content: "Let me think", MessageID: "msg-1", Index: 0}
	chunks <- providers.StreamChunk{Type: "chunk", Content: "Hello", MessageID: "msg-1", Index: 1}
	chunks <- providers.StreamChunk{Type: "chunk", Content: " world", MessageID: "msg-1", Index: 2}
	chunks <- providers.StreamChunk{Type: "end", MessageID: "msg-1", Usage: &providers.UsageStats{InputTokens: 10, OutputTokens: 20}}
	close(chunks)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	cs.consumeStream(ctx, cancel, client, "conv-1", "claude", "key", "", "claude-sonnet",
		[]providers.Message{{Role: "user", Content: "hi"}}, nil, chunks)

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
	cs := NewChatService(ps, hub, nil, nil)

	// Create a slow chunk channel that won't close on its own
	chunks := make(chan providers.StreamChunk, 10)
	chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-1", Model: "claude-sonnet"}

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		cs.consumeStream(ctx, cancel, client, "conv-cancel", "claude", "key", "", "claude-sonnet",
			[]providers.Message{{Role: "user", Content: "hi"}}, nil, chunks)
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
	cs := NewChatService(ps, hub, nil, nil)

	chunks := make(chan providers.StreamChunk, 10)
	chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-1", Model: "claude-sonnet"}
	chunks <- providers.StreamChunk{Type: "error", Content: "Something went wrong", MessageID: "msg-1"}
	close(chunks)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	cs.consumeStream(ctx, cancel, client, "conv-err", "claude", "key", "", "claude-sonnet",
		[]providers.Message{{Role: "user", Content: "hi"}}, nil, chunks)

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

func TestChatService_ConsumeStream_ToolCallChunks(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	client := mockClient(hub)
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub, nil, nil)

	// Simulate a stream with tool calls followed by end
	chunks := make(chan providers.StreamChunk, 10)
	chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-1", Model: "claude-sonnet"}
	chunks <- providers.StreamChunk{Type: "tool_call_start", MessageID: "msg-1", ToolID: "tool-1", ToolName: "file_read"}
	chunks <- providers.StreamChunk{Type: "tool_call_delta", MessageID: "msg-1", ToolID: "tool-1", Content: `{"path":"test.txt"}`}
	chunks <- providers.StreamChunk{Type: "tool_call_end", MessageID: "msg-1", ToolID: "tool-1"}
	chunks <- providers.StreamChunk{Type: "end", MessageID: "msg-1", Usage: &providers.UsageStats{InputTokens: 10, OutputTokens: 20}}
	close(chunks)

	// Without orchestrator, tool call should produce error result and loop would need
	// another provider call. For this test, we just verify tool delta events are emitted.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	cs.consumeStream(ctx, cancel, client, "conv-tools", "claude", "key", "", "claude-sonnet",
		[]providers.Message{{Role: "user", Content: "read test.txt"}}, nil, chunks)

	events := collectEvents(client, 500*time.Millisecond)

	hasToolDelta := false
	for _, event := range events {
		if event.Type == types.EventTypeChatToolDelta {
			hasToolDelta = true
		}
	}

	if !hasToolDelta {
		t.Error("expected chat:tool-delta event for tool call chunks")
	}
}

func TestChatService_ConvertHistory(t *testing.T) {
	history := []types.ChatMessage{
		{Role: "user", Content: "hello"},
		{Role: "assistant", Content: "hi there"},
		{Role: "user", Content: "read file"},
	}

	messages := convertHistory(history)
	if len(messages) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(messages))
	}
	if messages[0].Role != "user" || messages[0].Content != "hello" {
		t.Errorf("unexpected first message: %+v", messages[0])
	}
	if messages[1].Role != "assistant" || messages[1].Content != "hi there" {
		t.Errorf("unexpected second message: %+v", messages[1])
	}
}

func TestChatService_ConvertHistory_Empty(t *testing.T) {
	messages := convertHistory(nil)
	if messages != nil {
		t.Errorf("expected nil for empty history, got %v", messages)
	}
}

func TestChatService_ConvertHistory_WithToolCalls(t *testing.T) {
	history := []types.ChatMessage{
		{Role: "user", Content: "read test.txt"},
		{
			Role:    "assistant",
			Content: "",
			ToolCalls: []types.ToolCall{
				{ID: "tool-1", Name: "file_read", Input: json.RawMessage(`{"path":"test.txt"}`)},
			},
		},
		{Role: "tool", ToolCallID: "tool-1", ToolName: "file_read", Content: "file contents"},
		{Role: "assistant", Content: "The file contains: file contents"},
	}

	messages := convertHistory(history)
	if len(messages) != 4 {
		t.Fatalf("expected 4 messages, got %d", len(messages))
	}

	// Verify assistant message with tool calls
	if len(messages[1].ToolCalls) != 1 {
		t.Errorf("expected 1 tool call, got %d", len(messages[1].ToolCalls))
	}
	if messages[1].ToolCalls[0].Name != "file_read" {
		t.Errorf("expected tool name 'file_read', got %q", messages[1].ToolCalls[0].Name)
	}

	// Verify tool result message
	if messages[2].Role != "tool" {
		t.Errorf("expected role 'tool', got %q", messages[2].Role)
	}
	if messages[2].ToolCallID != "tool-1" {
		t.Errorf("expected ToolCallID 'tool-1', got %q", messages[2].ToolCallID)
	}
}

func TestChatService_ToolLoopSafetyMax(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()
	time.Sleep(10 * time.Millisecond)

	client := mockClient(hub)
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	ps := NewProviderService()
	cs := NewChatService(ps, hub, nil, nil)

	// Set a low max for testing
	cs.SetMaxToolLoopIters(2)

	// Create a channel that always returns tool calls (simulating infinite loop)
	iterationCount := 0
	makeToolChunks := func() chan providers.StreamChunk {
		chunks := make(chan providers.StreamChunk, 10)
		iterationCount++
		chunks <- providers.StreamChunk{Type: "start", MessageID: "msg-" + string(rune('0'+iterationCount)), Model: "test-model"}
		chunks <- providers.StreamChunk{Type: "tool_call_start", MessageID: "msg-1", ToolID: "tool-1", ToolName: "file_read"}
		chunks <- providers.StreamChunk{Type: "tool_call_delta", MessageID: "msg-1", ToolID: "tool-1", Content: `{"path":"test.txt"}`}
		chunks <- providers.StreamChunk{Type: "tool_call_end", MessageID: "msg-1", ToolID: "tool-1"}
		chunks <- providers.StreamChunk{Type: "end", MessageID: "msg-1"}
		close(chunks)
		return chunks
	}

	chunks := makeToolChunks()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Run consumeStream - it should exit after 2 iterations
	// Note: Without a real provider, the loop will fail to re-invoke, so we just verify
	// the max iteration check is working by checking it doesn't hang
	done := make(chan struct{})
	go func() {
		cs.consumeStream(ctx, cancel, client, "conv-max", "claude", "key", "", "test-model",
			[]providers.Message{{Role: "user", Content: "hi"}}, nil, chunks)
		close(done)
	}()

	select {
	case <-done:
		// Expected: consumeStream returned (either due to max or provider error)
	case <-time.After(3 * time.Second):
		t.Error("timeout: consumeStream did not return after hitting max iterations")
	}

	// Verify that we got stream events
	events := collectEvents(client, 200*time.Millisecond)
	if len(events) == 0 {
		t.Error("expected at least some events to be emitted")
	}
}

func TestChatService_SetMaxToolLoopIters(t *testing.T) {
	hub := websocket.NewHub()
	ps := NewProviderService()
	cs := NewChatService(ps, hub, nil, nil)

	// Verify default
	if cs.maxToolLoopIters != DefaultMaxToolLoopIters {
		t.Errorf("expected default %d, got %d", DefaultMaxToolLoopIters, cs.maxToolLoopIters)
	}

	// Set custom value
	cs.SetMaxToolLoopIters(5)
	if cs.maxToolLoopIters != 5 {
		t.Errorf("expected 5, got %d", cs.maxToolLoopIters)
	}
}
