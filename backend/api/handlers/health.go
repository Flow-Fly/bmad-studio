package handlers

import (
	"net/http"

	"bmad-studio/backend/api/response"
)

// HealthResponse represents the health check response
type HealthResponse struct {
	Status string `json:"status"`
}

// Health handles the health check endpoint
func Health(w http.ResponseWriter, r *http.Request) {
	response.WriteJSON(w, http.StatusOK, HealthResponse{Status: "ok"})
}
