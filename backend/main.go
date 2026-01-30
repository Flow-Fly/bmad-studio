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
