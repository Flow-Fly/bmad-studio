package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"bmad-studio/backend/api"
	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/services"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/tools"
	"bmad-studio/backend/types"
)

// initToolLayer initializes the tool execution layer for a project.
// Returns the orchestrator and registry, or nil if initialization fails.
func initToolLayer(projectRoot, projectName string, hub *websocket.Hub, configStore *storage.ConfigStore) (*services.ToolOrchestrator, *tools.ToolRegistry) {
	if projectRoot == "" {
		log.Printf("No project loaded — tool execution disabled")
		return nil, nil
	}

	homeDir, _ := os.UserHomeDir()
	centralRoot := filepath.Join(homeDir, ".bmad-studio", "projects", projectName)

	sandbox := tools.NewSandbox(projectRoot, centralRoot)
	registry := tools.NewRegistry()

	// Register core tools
	if err := registry.RegisterCore(tools.NewFileReadTool(sandbox)); err != nil {
		log.Printf("Warning: Failed to register file_read tool: %v", err)
	}
	if err := registry.RegisterCore(tools.NewFileWriteTool(sandbox)); err != nil {
		log.Printf("Warning: Failed to register file_write tool: %v", err)
	}
	if err := registry.RegisterCore(tools.NewBashTool(sandbox)); err != nil {
		log.Printf("Warning: Failed to register bash tool: %v", err)
	}

	// Web search providers
	var searchProviders []tools.SearchProvider
	searxngURL := os.Getenv("SEARXNG_URL")
	if searxngURL == "" {
		searxngURL = "http://localhost:8080"
	}
	searchProviders = append(searchProviders, tools.NewSearXNGProvider(searxngURL))

	// Brave Search fallback (BYOK via env var or config store)
	braveKey := os.Getenv("BRAVE_SEARCH_API_KEY")
	if braveKey == "" && configStore != nil {
		if settings, err := configStore.Load(); err == nil && settings.BraveSearchAPIKey != "" {
			braveKey = settings.BraveSearchAPIKey
		}
	}
	if braveKey != "" {
		searchProviders = append(searchProviders, tools.NewBraveSearchProvider(braveKey))
	}

	if err := registry.RegisterCore(tools.NewWebSearchTool(searchProviders)); err != nil {
		log.Printf("Warning: Failed to register web_search tool: %v", err)
	}

	orchestrator := services.NewToolOrchestrator(registry, sandbox, hub)
	log.Printf("Tool execution layer initialized: %d tools registered", len(registry.ListForScope(nil)))

	return orchestrator, registry
}

func main() {
	serverCtx, serverCancel := context.WithCancel(context.Background())
	defer serverCancel()

	hub := websocket.NewHub()
	go hub.Run()

	providerService := services.NewProviderService()

	// Initialize central store first
	centralStore, err := storage.NewCentralStore()
	if err != nil {
		log.Fatalf("Fatal: Failed to create central store: %v", err)
	}
	if err := centralStore.Init(); err != nil {
		log.Fatalf("Fatal: Failed to initialize central store: %v", err)
	}
	log.Printf("Central store initialized at: %s", centralStore.RootDir())

	// Create config store using central store
	configStore := storage.NewConfigStore(centralStore)

	// Create registry store and project store using central store
	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)

	// Create stream store
	streamStore := storage.NewStreamStore(centralStore)

	// Create project service
	projectService := services.NewProjectService(registryStore, projectStore)

	// Create stream service
	streamService := services.NewStreamService(streamStore, registryStore, hub)

	// Create stream artifact service
	streamArtifactService := services.NewStreamArtifactService(streamStore)

	// Create worktree service
	worktreeService := services.NewWorktreeService(registryStore, streamStore)

	// Wire worktree service into stream service for archive-time cleanup
	streamService.SetWorktreeService(worktreeService)

	// Create and start watcher service for central store stream directories
	watcherService := services.NewWatcherService(centralStore, streamStore, registryStore, hub)
	if err := watcherService.Start(); err != nil {
		log.Printf("Warning: Failed to start watcher service: %v", err)
	} else {
		// Wire watcher hook into stream service for dynamic stream create/archive notifications
		streamService.SetWatcherHook(watcherService)
		// Wire phase deriver into stream service for on-demand phase derivation
		streamService.SetPhaseDeriver(watcherService)
	}

	// Create insight store and service
	insightStore, err := storage.NewInsightStore()
	if err != nil {
		log.Printf("Warning: Failed to initialize insight store: %v", err)
	}
	var insightService *services.InsightService
	if insightStore != nil {
		insightService = services.NewInsightService(insightStore, providerService)
	}

	// Create chat service first (tools will be set via callback when project loads)
	chatService := services.NewChatService(providerService, hub, nil, nil)

	projectManager := services.NewProjectManager(hub)

	// Set up callback to initialize tools and save project history when a project is loaded
	projectManager.OnProjectLoaded = func(projectRoot, projectName string) {
		orchestrator, registry := initToolLayer(projectRoot, projectName, hub, configStore)
		chatService.SetToolLayer(orchestrator, registry)

		// Update recent projects in config store
		if configStore != nil {
			if err := configStore.Update(func(settings *types.Settings) {
				// Create project entry with current timestamp
				now := types.Timestamp(time.Now())
				entry := types.ProjectEntry{
					Name:       projectName,
					Path:       projectRoot,
					LastOpened: now,
				}

				// Remove existing entry for this path (if any) and add to front
				filtered := make([]types.ProjectEntry, 0, len(settings.RecentProjects))
				for _, p := range settings.RecentProjects {
					if p.Path != projectRoot {
						filtered = append(filtered, p)
					}
				}
				settings.RecentProjects = append([]types.ProjectEntry{entry}, filtered...)

				// Limit to 10 recent projects
				if len(settings.RecentProjects) > 10 {
					settings.RecentProjects = settings.RecentProjects[:10]
				}

				// Set as last active project
				settings.LastActiveProjectPath = projectRoot
			}); err != nil {
				log.Printf("Warning: Failed to update recent projects: %v", err)
			}
		}
	}

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
			if err := chatService.HandleMessage(serverCtx, client, payload); err != nil {
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

		case types.EventTypeChatToolApprove:
			orch := chatService.Orchestrator()
			if orch == nil {
				log.Printf("Chat: tool-approve received but orchestrator not initialized")
				return
			}
			payloadBytes, err := json.Marshal(event.Payload)
			if err != nil {
				log.Printf("Chat: failed to marshal chat:tool-approve payload: %v", err)
				return
			}
			var payload types.ChatToolApprovePayload
			if err := json.Unmarshal(payloadBytes, &payload); err != nil {
				log.Printf("Chat: failed to parse chat:tool-approve payload: %v", err)
				return
			}
			orch.HandleApproval(payload.ToolID, payload.Approved)

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
		Insight:        insightService,
		Project:        projectService,
		Stream:          streamService,
		StreamArtifact:  streamArtifactService,
		Worktree:        worktreeService,
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

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	serverCancel()
	watcherService.Stop()
	projectManager.Stop()
	hub.Stop()

	log.Println("Server stopped")
}
