package api_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"bmad-studio/backend/api"
	"bmad-studio/backend/api/websocket"

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
