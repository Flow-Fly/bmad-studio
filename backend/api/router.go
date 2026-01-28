package api

import (
	"bmad-studio/backend/api/handlers"
	"bmad-studio/backend/api/middleware"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// NewRouter creates and configures the main router with all routes and middleware
func NewRouter() *chi.Mux {
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
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", handlers.GetProject)
				r.Put("/", handlers.UpdateProject)
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
			r.Get("/", handlers.GetSettings)
			r.Put("/", handlers.UpdateSettings)
		})

		// Providers resource
		r.Route("/providers", func(r chi.Router) {
			r.Get("/", handlers.ListProviders)
			r.Post("/", handlers.AddProvider)
		})
	})

	return r
}
