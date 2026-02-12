package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"bmad-studio/backend/api"
	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/types"

	ws "github.com/gorilla/websocket"
)

func TestWebSocketUpgrade(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	// Create test server
	server := httptest.NewServer(router)
	defer server.Close()

	// Convert http:// to ws://
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Connect via WebSocket
	dialer := ws.Dialer{}
	conn, resp, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Errorf("Expected status 101 Switching Protocols, got %d", resp.StatusCode)
	}
}

func TestWebSocketReceivesBroadcast(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	dialer := ws.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// Read and discard connection:status message
	conn.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err = conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read connection:status: %v", err)
	}

	// Wait for client to be registered
	time.Sleep(50 * time.Millisecond)

	// Broadcast a message
	testMessage := []byte(`{"type":"test","payload":"hello"}`)
	hub.Broadcast(testMessage)

	// Read with timeout
	conn.SetReadDeadline(time.Now().Add(time.Second))
	_, message, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read message: %v", err)
	}

	if string(message) != string(testMessage) {
		t.Errorf("Expected message %q, got %q", testMessage, message)
	}
}

func TestMultipleWebSocketClientsReceiveBroadcast(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Connect multiple clients
	conns := make([]*ws.Conn, 3)
	for i := range conns {
		dialer := ws.Dialer{}
		conn, _, err := dialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("Failed to connect client %d: %v", i, err)
		}
		defer conn.Close()
		conns[i] = conn
	}

	// Read and discard connection:status from each client
	for i, conn := range conns {
		conn.SetReadDeadline(time.Now().Add(time.Second))
		_, _, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("Client %d failed to read connection:status: %v", i, err)
		}
	}

	// Wait for clients to be registered
	time.Sleep(100 * time.Millisecond)

	// Verify client count
	if hub.ClientCount() != 3 {
		t.Errorf("Expected 3 clients, got %d", hub.ClientCount())
	}

	// Broadcast a message
	testMessage := []byte(`{"type":"broadcast-test","payload":"to-all"}`)
	hub.Broadcast(testMessage)

	// All clients should receive the message
	for i, conn := range conns {
		conn.SetReadDeadline(time.Now().Add(time.Second))
		_, message, err := conn.ReadMessage()
		if err != nil {
			t.Errorf("Client %d failed to read: %v", i, err)
			continue
		}
		if string(message) != string(testMessage) {
			t.Errorf("Client %d expected %q, got %q", i, testMessage, message)
		}
	}
}

func TestWebSocketDisconnectionHandled(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	dialer := ws.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}

	// Wait for registration
	time.Sleep(50 * time.Millisecond)

	initialCount := hub.ClientCount()
	if initialCount != 1 {
		t.Errorf("Expected 1 client after connect, got %d", initialCount)
	}

	// Close connection
	conn.Close()

	// Wait for unregistration to be processed
	time.Sleep(100 * time.Millisecond)

	// Client count should be 0
	if hub.ClientCount() != 0 {
		t.Errorf("Expected 0 clients after disconnect, got %d", hub.ClientCount())
	}
}

func TestWebSocketRouteNotExistsWithoutHub(t *testing.T) {
	// Router without hub
	router := api.NewRouterWithServices(api.RouterServices{})

	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	// Should return 404 when hub is nil
	if rec.Code != http.StatusNotFound {
		t.Errorf("Expected status 404 when hub is nil, got %d", rec.Code)
	}
}

func TestWebSocketCheckOrigin(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Test with localhost origin (should be allowed)
	dialer := ws.Dialer{}
	header := http.Header{}
	header.Set("Origin", "http://localhost:5173")

	conn, _, err := dialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("Connection with localhost origin should be allowed: %v", err)
	}
	conn.Close()

	// Wait for cleanup
	time.Sleep(50 * time.Millisecond)
}

func TestWebSocketConnectionStatusOnConnect(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	dialer := ws.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket: %v", err)
	}
	defer conn.Close()

	// First message should be connection:status
	conn.SetReadDeadline(time.Now().Add(time.Second))
	_, message, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read connection:status: %v", err)
	}

	var event types.WebSocketEvent
	if err := json.Unmarshal(message, &event); err != nil {
		t.Fatalf("Failed to unmarshal event: %v", err)
	}

	if event.Type != types.EventTypeConnectionStatus {
		t.Errorf("Expected first event type %q, got %q", types.EventTypeConnectionStatus, event.Type)
	}

	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		t.Fatalf("Failed to marshal payload: %v", err)
	}

	var payload types.ConnectionStatusPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		t.Fatalf("Failed to unmarshal payload: %v", err)
	}

	if payload.Status != "connected" {
		t.Errorf("Expected status %q, got %q", "connected", payload.Status)
	}
}

func TestWebSocketConnectionStatusOnReconnect(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// First connection
	dialer := ws.Dialer{}
	conn1, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect first time: %v", err)
	}

	// Read and discard connection:status from first connection
	conn1.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err = conn1.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read first connection:status: %v", err)
	}

	// Disconnect
	conn1.Close()

	// Wait for unregistration
	time.Sleep(100 * time.Millisecond)

	// Reconnect
	conn2, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to reconnect: %v", err)
	}
	defer conn2.Close()

	// Should receive connection:status on reconnect
	conn2.SetReadDeadline(time.Now().Add(time.Second))
	_, message, err := conn2.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read connection:status on reconnect: %v", err)
	}

	var event types.WebSocketEvent
	if err := json.Unmarshal(message, &event); err != nil {
		t.Fatalf("Failed to unmarshal event: %v", err)
	}

	if event.Type != types.EventTypeConnectionStatus {
		t.Errorf("Expected connection:status on reconnect, got %q", event.Type)
	}
}

func TestWebSocketMultipleClientsReceiveOwnConnectionStatus(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Connect 3 clients
	conns := make([]*ws.Conn, 3)
	for i := range conns {
		dialer := ws.Dialer{}
		conn, _, err := dialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("Failed to connect client %d: %v", i, err)
		}
		defer conn.Close()
		conns[i] = conn
	}

	// Each client should receive their own connection:status
	for i, conn := range conns {
		conn.SetReadDeadline(time.Now().Add(time.Second))
		_, message, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("Client %d failed to read connection:status: %v", i, err)
		}

		var event types.WebSocketEvent
		if err := json.Unmarshal(message, &event); err != nil {
			t.Fatalf("Client %d failed to unmarshal event: %v", i, err)
		}

		if event.Type != types.EventTypeConnectionStatus {
			t.Errorf("Client %d expected connection:status, got %q", i, event.Type)
		}
	}
}

func TestWebSocketBroadcastAfterConnectionStatus(t *testing.T) {
	hub := websocket.NewHub()
	go hub.Run()
	defer hub.Stop()

	router := api.NewRouterWithServices(api.RouterServices{Hub: hub})

	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	dialer := ws.Dialer{}
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	// First message should be connection:status
	conn.SetReadDeadline(time.Now().Add(time.Second))
	_, msg1, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read connection:status: %v", err)
	}

	var event1 types.WebSocketEvent
	if err := json.Unmarshal(msg1, &event1); err != nil {
		t.Fatalf("Failed to unmarshal first event: %v", err)
	}

	if event1.Type != types.EventTypeConnectionStatus {
		t.Errorf("Expected first event to be connection:status, got %q", event1.Type)
	}

	// Wait for client to be fully registered
	time.Sleep(50 * time.Millisecond)

	// Broadcast a test message
	testMessage := []byte(`{"type":"test-event","payload":"broadcast-test"}`)
	hub.Broadcast(testMessage)

	// Second message should be the broadcast
	conn.SetReadDeadline(time.Now().Add(time.Second))
	_, msg2, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read broadcast: %v", err)
	}

	if string(msg2) != string(testMessage) {
		t.Errorf("Expected broadcast %q, got %q", testMessage, msg2)
	}
}
