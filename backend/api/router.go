package api

import (
	"bmad-studio/backend/api/handlers"
	"bmad-studio/backend/api/middleware"
	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/services"
	"bmad-studio/backend/storage"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// RouterServices groups the optional service dependencies for the router.
// All fields are optional and may be nil.
type RouterServices struct {
	BMadConfig     *services.BMadConfigService
	WorkflowPath   *services.WorkflowPathService
	Agent          *services.AgentService
	WorkflowStatus *services.WorkflowStatusService
	Artifact       *services.ArtifactService
	Provider       *services.ProviderService
	ConfigStore    *storage.ConfigStore
	Hub            *websocket.Hub
	ProjectManager *services.ProjectManager
	Insight        *services.InsightService
	Project        *services.ProjectService // Prepared for Story 1.3: REST API endpoints
}

// NewRouter creates and configures the main router with all routes and middleware
func NewRouter() *chi.Mux {
	return NewRouterWithServices(RouterServices{})
}

// NewRouterWithServices creates the router with optional service dependencies
func NewRouterWithServices(svc RouterServices) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RequestID)
	r.Use(middleware.CORS)

	// Health check endpoint (at root, not under /api/v1)
	r.Get("/health", handlers.Health)

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Projects resource
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", handlers.ListProjects)
			r.Post("/", handlers.CreateProject)

			if svc.ProjectManager != nil {
				projectHandler := handlers.NewProjectHandler(svc.ProjectManager)
				r.Post("/open", projectHandler.OpenProject)
			}

			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", handlers.GetProject)
				r.Put("/", handlers.UpdateProject)

				// Files resource (nested under project)
				if svc.ProjectManager != nil {
					fileHandler := handlers.NewFileHandler(services.NewFileService(svc.ProjectManager))
					r.Route("/files", func(r chi.Router) {
						r.Get("/", fileHandler.ListFiles)
						r.Get("/*", fileHandler.ReadFile)
					})
				}

				// Insights resource (nested under project)
				if svc.Insight != nil {
					insightHandler := handlers.NewInsightHandler(svc.Insight)
					r.Route("/insights", func(r chi.Router) {
						r.Get("/", insightHandler.ListInsights)
						r.Post("/", insightHandler.CreateInsight)
						r.Post("/compact", insightHandler.CompactInsight)
						r.Route("/{insightId}", func(r chi.Router) {
							r.Get("/", insightHandler.GetInsight)
							r.Put("/", insightHandler.UpdateInsight)
							r.Delete("/", insightHandler.DeleteInsight)
						})
					})
				}
			})
		})

		// Sessions resource
		r.Route("/sessions", func(r chi.Router) {
			r.Get("/", handlers.ListSessions)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", handlers.GetSession)
			})
		})

		// Settings resource
		r.Route("/settings", func(r chi.Router) {
			if svc.ConfigStore != nil {
				settingsHandler := handlers.NewSettingsHandler(svc.ConfigStore)
				r.Get("/", settingsHandler.GetSettings)
				r.Put("/", settingsHandler.UpdateSettings)
			}
		})

		// Providers resource
		r.Route("/providers", func(r chi.Router) {
			r.Get("/", handlers.ListProviders)
			r.Post("/", handlers.AddProvider)

			if svc.Provider != nil {
				providerHandler := handlers.NewProviderHandler(svc.Provider)
				r.Post("/validate", providerHandler.ValidateProvider)
				r.Get("/{type}/models", providerHandler.ListModels)
			}
		})

		// BMAD resource — always registered when ProjectManager is available;
		// handlers resolve services dynamically per request to support project switching
		if svc.ProjectManager != nil {
			bmadHandler := handlers.NewBMadHandler(svc.ProjectManager)
			artifactHandler := handlers.NewArtifactHandler(svc.ProjectManager)
			r.Route("/bmad", func(r chi.Router) {
				r.Get("/config", bmadHandler.GetConfig)
				r.Get("/phases", bmadHandler.GetPhases)
				r.Get("/agents", bmadHandler.GetAgents)
				r.Get("/agents/{id}", bmadHandler.GetAgent)
				r.Get("/status", bmadHandler.GetStatus)
				r.Get("/artifacts", artifactHandler.GetArtifacts)
				r.Get("/artifacts/{id}", artifactHandler.GetArtifact)
			})
		}
	})

	// WebSocket endpoint (outside /api/v1 for cleaner URL)
	if svc.Hub != nil {
		wsHandler := handlers.NewWebSocketHandler(svc.Hub)
		r.Get("/ws", wsHandler.HandleWebSocket)
	}

	return r
}
