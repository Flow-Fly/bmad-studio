package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"bmad-studio/backend/api"
	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/services"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

func main() {
	hub := websocket.NewHub()
	go hub.Run()

	projectManager := services.NewProjectManager(hub)

	// Auto-load project from BMAD_PROJECT_ROOT or current directory
	projectRoot := os.Getenv("BMAD_PROJECT_ROOT")
	if projectRoot == "" {
		var err error
		projectRoot, err = os.Getwd()
		if err != nil {
			log.Printf("Warning: Failed to get current directory: %v", err)
		}
	}

	if projectRoot != "" {
		if info, err := projectManager.LoadProject(projectRoot); err != nil {
			log.Printf("Warning: Failed to load initial project: %v", err)
		} else {
			log.Printf("Loaded project: %s (%s)", info.ProjectName, info.ProjectRoot)
		}
	}

	providerService := services.NewProviderService()

	configStore, err := storage.NewConfigStore()
	if err != nil {
		log.Printf("Warning: Failed to initialize config store: %v", err)
	}

	chatService := services.NewChatService(providerService, hub)

	hub.SetMessageHandler(func(client *websocket.Client, event *types.WebSocketEvent) {
		switch event.Type {
		case types.EventTypeChatSend:
			payloadBytes, err := json.Marshal(event.Payload)
			if err != nil {
				log.Printf("Chat: failed to marshal chat:send payload: %v", err)
				return
			}
			var payload types.ChatSendPayload
			if err := json.Unmarshal(payloadBytes, &payload); err != nil {
				log.Printf("Chat: failed to parse chat:send payload: %v", err)
				return
			}
			if err := chatService.HandleMessage(context.Background(), client, payload); err != nil {
				log.Printf("Chat: HandleMessage error: %v", err)
				errorEvent := types.NewChatErrorEvent(payload.ConversationID, "", "invalid_request", err.Error())
				hub.SendToClient(client, errorEvent)
			}

		case types.EventTypeChatCancel:
			payloadBytes, err := json.Marshal(event.Payload)
			if err != nil {
				log.Printf("Chat: failed to marshal chat:cancel payload: %v", err)
				return
			}
			var payload types.ChatCancelPayload
			if err := json.Unmarshal(payloadBytes, &payload); err != nil {
				log.Printf("Chat: failed to parse chat:cancel payload: %v", err)
				return
			}
			if err := chatService.CancelStream(payload.ConversationID); err != nil {
				log.Printf("Chat: CancelStream error: %v", err)
			}

		default:
			// Unknown message types — log and ignore
			log.Printf("WebSocket: unknown message type from client: %s", event.Type)
		}
	})

	router := api.NewRouterWithServices(api.RouterServices{
		Provider:       providerService,
		ConfigStore:    configStore,
		Hub:            hub,
		ProjectManager: projectManager,
		ChatService:    chatService,
	})

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	server := &http.Server{Addr: ":3008", Handler: router}
	go func() {
		log.Println("Starting BMAD Studio backend on http://localhost:3008")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start:", err)
		}
	}()

	<-stop
	log.Println("Shutting down...")

	projectManager.Stop()
	hub.Stop()

	log.Println("Server stopped")
}
