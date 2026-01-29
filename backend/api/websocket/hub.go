package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"bmad-studio/backend/types"
)

// Hub maintains the set of active clients and broadcasts messages to clients
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from clients (for future use)
	broadcast chan []byte

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Done channel for graceful shutdown
	done chan struct{}

	// Mutex for thread-safe client operations
	mu sync.RWMutex

	// Running state
	running bool
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		done:       make(chan struct{}),
	}
}

// Run starts the hub's main loop
// This should be run in a goroutine
func (h *Hub) Run() {
	h.mu.Lock()
	h.running = true
	h.mu.Unlock()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected. Total clients: %d", h.ClientCount())

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected. Total clients: %d", h.ClientCount())

		case message := <-h.broadcast:
			h.mu.RLock()
			var slowClients []*Client
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					slowClients = append(slowClients, client)
				}
			}
			h.mu.RUnlock()

			// Remove slow clients outside the iteration to avoid lock upgrade
			if len(slowClients) > 0 {
				h.mu.Lock()
				for _, client := range slowClients {
					if _, ok := h.clients[client]; ok {
						close(client.send)
						delete(h.clients, client)
					}
				}
				h.mu.Unlock()
			}

		case <-h.done:
			h.mu.Lock()
			h.running = false
			// Close all client connections
			for client := range h.clients {
				close(client.send)
				delete(h.clients, client)
			}
			h.mu.Unlock()
			return
		}
	}
}

// Stop gracefully shuts down the hub
func (h *Hub) Stop() {
	h.mu.RLock()
	running := h.running
	h.mu.RUnlock()

	if running {
		close(h.done)
	}
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(message []byte) {
	h.mu.RLock()
	running := h.running
	h.mu.RUnlock()

	if !running {
		return
	}

	select {
	case h.broadcast <- message:
	default:
		log.Printf("Warning: Broadcast channel full, message dropped")
	}
}

// BroadcastEvent sends a WebSocket event to all connected clients
func (h *Hub) BroadcastEvent(event *types.WebSocketEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshaling WebSocket event: %v", err)
		return
	}
	h.Broadcast(data)
}

// Register adds a client to the hub
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister removes a client from the hub
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// ClientCount returns the number of connected clients
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// IsRunning returns whether the hub is currently running
func (h *Hub) IsRunning() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.running
}
