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
)

func main() {
	// Determine project root from environment or current directory
	projectRoot := os.Getenv("BMAD_PROJECT_ROOT")
	if projectRoot == "" {
		var err error
		projectRoot, err = os.Getwd()
		if err != nil {
			log.Fatal("Failed to get current directory:", err)
		}
	}

	// Initialize services
	configService := services.NewBMadConfigService()
	if err := configService.LoadConfig(projectRoot); err != nil {
		log.Printf("Warning: Failed to load BMAD config: %v", err)
		// Continue with nil config - endpoints will return appropriate errors
	}

	var workflowPathService *services.WorkflowPathService
	if configService.GetConfig() != nil {
		workflowPathService = services.NewWorkflowPathService(configService)
		if err := workflowPathService.LoadPaths(); err != nil {
			log.Printf("Warning: Failed to load workflow paths: %v", err)
		}
	}

	var agentService *services.AgentService
	if configService.GetConfig() != nil {
		agentService = services.NewAgentService(configService)
		if err := agentService.LoadAgents(); err != nil {
			log.Printf("Warning: Failed to load agents: %v", err)
		}
	}

	var workflowStatusService *services.WorkflowStatusService
	if configService.GetConfig() != nil && workflowPathService != nil {
		workflowStatusService = services.NewWorkflowStatusService(configService, workflowPathService)
		if err := workflowStatusService.LoadStatus(); err != nil {
			log.Printf("Warning: Failed to load workflow status: %v", err)
		}
	}

	var artifactService *services.ArtifactService
	if configService.GetConfig() != nil {
		artifactService = services.NewArtifactService(configService, workflowStatusService)
		if err := artifactService.LoadArtifacts(); err != nil {
			log.Printf("Warning: Failed to load artifacts: %v", err)
		}
	}

	// Create WebSocket hub
	hub := websocket.NewHub()
	go hub.Run()

	// Create and start file watcher
	var fileWatcherService *services.FileWatcherService
	if configService.GetConfig() != nil && artifactService != nil && workflowStatusService != nil {
		fileWatcherService = services.NewFileWatcherService(hub, configService, artifactService, workflowStatusService)
		if err := fileWatcherService.Start(); err != nil {
			log.Printf("Warning: Failed to start file watcher: %v", err)
		}
	}

	// Create router with all services
	router := api.NewRouterWithServices(configService, workflowPathService, agentService, workflowStatusService, artifactService, hub)

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

	// Stop services in reverse order
	if fileWatcherService != nil {
		fileWatcherService.Stop()
	}
	hub.Stop()

	log.Println("Server stopped")
}
