package handlers

import (
	"log"
	"net/http"

	"bmad-studio/backend/api/websocket"

	ws "github.com/gorilla/websocket"
)

var upgrader = ws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow connections from localhost for development
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		// Allow localhost origins (development)
		if origin == "" || origin == "http://localhost:5173" || origin == "http://localhost:3007" || origin == "http://localhost:3008" || origin == "http://127.0.0.1:5173" || origin == "http://127.0.0.1:3007" || origin == "http://127.0.0.1:3008" {
			return true
		}
		// Allow tauri:// and file:// origins for desktop app
		if len(origin) >= 6 && (origin[:6] == "tauri:" || origin[:5] == "file:") {
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
}
