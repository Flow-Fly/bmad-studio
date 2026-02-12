package handlers

import (
	"log"
	"net/http"
	"strings"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/types"

	ws "github.com/gorilla/websocket"
)

// allowedOrigins lists the localhost origins permitted during development
var allowedOrigins = map[string]bool{
	"":                          true,
	"http://localhost:5173":     true,
	"http://localhost:3007":     true,
	"http://localhost:3008":     true,
	"http://127.0.0.1:5173":    true,
	"http://127.0.0.1:3007":    true,
	"http://127.0.0.1:3008":    true,
}

var upgrader = ws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")

		if allowedOrigins[origin] {
			return true
		}

		// Allow tauri:// and file:// origins for desktop app
		if strings.HasPrefix(origin, "tauri:") || strings.HasPrefix(origin, "file:") {
			return true
		}

		log.Printf("WebSocket connection rejected from origin: %s", origin)
		return false
	},
}

// WebSocketHandler handles WebSocket connection upgrades
type WebSocketHandler struct {
	hub *websocket.Hub
}

// NewWebSocketHandler creates a new WebSocketHandler
func NewWebSocketHandler(hub *websocket.Hub) *WebSocketHandler {
	return &WebSocketHandler{hub: hub}
}

// HandleWebSocket upgrades HTTP connection to WebSocket and registers client with hub
func (h *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	client := websocket.NewClient(h.hub, conn)
	h.hub.Register(client)
	client.Start()

	// Send connection:status to the newly connected client
	go func() {
		// Brief delay to ensure write pump is ready
		time.Sleep(10 * time.Millisecond)
		event := types.NewWebSocketEvent(types.EventTypeConnectionStatus, &types.ConnectionStatusPayload{
			Status: "connected",
		})
		_ = h.hub.SendToClient(client, event)
	}()
}
