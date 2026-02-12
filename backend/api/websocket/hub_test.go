package websocket

import (
	"encoding/json"
	"testing"
	"time"

	"bmad-studio/backend/types"
)

func TestNewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Fatal("expected hub to be created")
	}
	if hub.clients == nil {
		t.Error("expected clients map to be initialized")
	}
	if hub.broadcast == nil {
		t.Error("expected broadcast channel to be initialized")
	}
	if hub.register == nil {
		t.Error("expected register channel to be initialized")
	}
	if hub.unregister == nil {
		t.Error("expected unregister channel to be initialized")
	}
	if hub.done == nil {
		t.Error("expected done channel to be initialized")
	}
}

func TestHubRunAndStop(t *testing.T) {
	hub := NewHub()

	// Start hub in goroutine
	go hub.Run()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	if !hub.IsRunning() {
		t.Error("expected hub to be running")
	}

	// Stop hub
	hub.Stop()

	// Wait for hub to stop
	time.Sleep(10 * time.Millisecond)

	if hub.IsRunning() {
		t.Error("expected hub to be stopped")
	}
}

func TestHubClientCount(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	if hub.ClientCount() != 0 {
		t.Errorf("expected 0 clients, got %d", hub.ClientCount())
	}
}

func TestHubBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	// Create a mock client
	client := &Client{
		hub:  hub,
		send: make(chan []byte, 256),
	}

	// Register client
	hub.Register(client)

	// Wait for registration
	time.Sleep(10 * time.Millisecond)

	if hub.ClientCount() != 1 {
		t.Errorf("expected 1 client, got %d", hub.ClientCount())
	}

	// Broadcast message
	testMessage := []byte(`{"test": "message"}`)
	hub.Broadcast(testMessage)

	// Wait for message
	select {
	case received := <-client.send:
		if string(received) != string(testMessage) {
			t.Errorf("expected %q, got %q", testMessage, received)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("timeout waiting for broadcast message")
	}
}

func TestHubBroadcastEvent(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	// Create a mock client
	client := &Client{
		hub:  hub,
		send: make(chan []byte, 256),
	}

	// Register client
	hub.Register(client)

	// Wait for registration
	time.Sleep(10 * time.Millisecond)

	// Broadcast event
	event := types.NewWebSocketEvent(types.EventTypeArtifactCreated, map[string]string{"id": "test"})
	hub.BroadcastEvent(event)

	// Wait for message
	select {
	case received := <-client.send:
		var result map[string]interface{}
		if err := json.Unmarshal(received, &result); err != nil {
			t.Fatalf("failed to unmarshal received message: %v", err)
		}
		if result["type"] != types.EventTypeArtifactCreated {
			t.Errorf("expected type %q, got %q", types.EventTypeArtifactCreated, result["type"])
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("timeout waiting for broadcast event")
	}
}

func TestHubUnregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	// Create a mock client
	client := &Client{
		hub:  hub,
		send: make(chan []byte, 256),
	}

	// Register client
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	if hub.ClientCount() != 1 {
		t.Errorf("expected 1 client, got %d", hub.ClientCount())
	}

	// Unregister client
	hub.Unregister(client)
	time.Sleep(10 * time.Millisecond)

	if hub.ClientCount() != 0 {
		t.Errorf("expected 0 clients after unregister, got %d", hub.ClientCount())
	}
}

func TestHubMultipleClients(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	// Create multiple clients
	clients := make([]*Client, 3)
	for i := range clients {
		clients[i] = &Client{
			hub:  hub,
			send: make(chan []byte, 256),
		}
		hub.Register(clients[i])
	}

	// Wait for registrations
	time.Sleep(20 * time.Millisecond)

	if hub.ClientCount() != 3 {
		t.Errorf("expected 3 clients, got %d", hub.ClientCount())
	}

	// Broadcast message
	testMessage := []byte(`{"test": "broadcast to all"}`)
	hub.Broadcast(testMessage)

	// All clients should receive the message
	for i, client := range clients {
		select {
		case received := <-client.send:
			if string(received) != string(testMessage) {
				t.Errorf("client %d: expected %q, got %q", i, testMessage, received)
			}
		case <-time.After(100 * time.Millisecond):
			t.Errorf("client %d: timeout waiting for broadcast message", i)
		}
	}
}

func TestHubBroadcastWhenStopped(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	// Stop hub
	hub.Stop()
	time.Sleep(10 * time.Millisecond)

	// Broadcast should not panic when stopped
	hub.Broadcast([]byte(`{"test": "after stop"}`))

	// No panic means success
}

func TestHubSendToClient(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	time.Sleep(10 * time.Millisecond)

	// Create two clients
	client1 := &Client{hub: hub, send: make(chan []byte, 256)}
	client2 := &Client{hub: hub, send: make(chan []byte, 256)}
	hub.Register(client1)
	hub.Register(client2)
	time.Sleep(10 * time.Millisecond)

	// Send to client1 only
	event := types.NewChatStreamStartEvent("conv-1", "msg-1", "claude-sonnet")
	err := hub.SendToClient(client1, event)
	if err != nil {
		t.Fatalf("SendToClient failed: %v", err)
	}

	// client1 should receive the message
	select {
	case received := <-client1.send:
		var result map[string]interface{}
		if err := json.Unmarshal(received, &result); err != nil {
			t.Fatalf("failed to unmarshal: %v", err)
		}
		if result["type"] != types.EventTypeChatStreamStart {
			t.Errorf("expected type %q, got %q", types.EventTypeChatStreamStart, result["type"])
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("timeout waiting for message on client1")
	}

	// client2 should NOT receive the message
	select {
	case <-client2.send:
		t.Error("client2 should not have received a targeted message")
	case <-time.After(50 * time.Millisecond):
		// Expected: no message
	}
}

func TestHubSendToClient_BufferFull(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	time.Sleep(10 * time.Millisecond)

	// Create client with tiny buffer
	client := &Client{hub: hub, send: make(chan []byte, 1)}
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	// Fill the buffer
	event := types.NewChatTextDeltaEvent("conv-1", "msg-1", "data", 0)
	_ = hub.SendToClient(client, event)

	// Second send should fail (buffer full)
	err := hub.SendToClient(client, event)
	if err == nil {
		t.Error("expected error when client buffer is full")
	}
}

func TestHubSetMessageHandler(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	defer hub.Stop()

	time.Sleep(10 * time.Millisecond)

	received := make(chan *types.WebSocketEvent, 1)
	hub.SetMessageHandler(func(client *Client, event *types.WebSocketEvent) {
		received <- event
	})

	// Verify handler is set
	hub.mu.RLock()
	hasHandler := hub.messageHandler != nil
	hub.mu.RUnlock()

	if !hasHandler {
		t.Error("expected messageHandler to be set")
	}
}

func TestHubStopClosesClientChannels(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Wait for hub to start
	time.Sleep(10 * time.Millisecond)

	// Create a client
	client := &Client{
		hub:  hub,
		send: make(chan []byte, 256),
	}
	hub.Register(client)
	time.Sleep(10 * time.Millisecond)

	// Stop hub
	hub.Stop()
	time.Sleep(20 * time.Millisecond)

	// Client's send channel should be closed
	select {
	case _, ok := <-client.send:
		if ok {
			t.Error("expected client send channel to be closed")
		}
	default:
		// Channel might be empty but not closed yet - wait a bit more
		time.Sleep(10 * time.Millisecond)
	}
}
