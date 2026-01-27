package api

import (
	"encoding/json"
	"log"
	"net/http"

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

	// Health check endpoint
	r.Get("/health", healthHandler)

	// API routes will be added here in future stories
	// r.Route("/api", func(r chi.Router) {
	//     r.Mount("/projects", handlers.ProjectRouter())
	//     r.Mount("/sessions", handlers.SessionRouter())
	// })

	return r
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status string `json:"status"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{Status: "ok"})
}

// writeJSON writes a JSON response with the given status code
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}
