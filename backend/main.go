package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"bmad-studio/backend/api"
	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/services"
	"bmad-studio/backend/storage"
)

func main() {
	// Create WebSocket hub (always available, even without BMAD config)
	hub := websocket.NewHub()
	go hub.Run()

	// Create ProjectManager for dynamic project loading
	projectManager := services.NewProjectManager(hub)

	// Auto-load project from environment or current directory at startup
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

	// Initialize provider service (always available, not BMAD-dependent)
	providerService := services.NewProviderService()

	// Initialize config store for settings persistence
	configStore, err := storage.NewConfigStore()
	if err != nil {
		log.Printf("Warning: Failed to initialize config store: %v", err)
	}

	// Create router with all services
	router := api.NewRouterWithServices(api.RouterServices{
		BMadConfig:     projectManager.ConfigService(),
		WorkflowPath:   projectManager.WorkflowPathService(),
		Agent:          projectManager.AgentService(),
		WorkflowStatus: projectManager.WorkflowStatusService(),
		Artifact:       projectManager.ArtifactService(),
		Provider:       providerService,
		ConfigStore:    configStore,
		Hub:            hub,
		ProjectManager: projectManager,
	})

	// Setup graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	// Start server in goroutine
	server := &http.Server{Addr: ":3008", Handler: router}
	go func() {
		log.Println("Starting BMAD Studio backend on http://localhost:3008")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed to start:", err)
		}
	}()

	// Wait for shutdown signal
	<-stop
	log.Println("Shutting down...")

	// Stop services
	projectManager.Stop()
	hub.Stop()

	log.Println("Server stopped")
}
