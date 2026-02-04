package handlers

import (
	"encoding/json"
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"bmad-studio/backend/types"

	"github.com/go-chi/chi/v5"
)

// InsightHandler handles Insight-related API endpoints.
type InsightHandler struct {
	service *services.InsightService
}

// NewInsightHandler creates a new InsightHandler with the given service.
func NewInsightHandler(service *services.InsightService) *InsightHandler {
	return &InsightHandler{service: service}
}

// CreateInsight handles POST /api/v1/projects/{id}/insights.
func (h *InsightHandler) CreateInsight(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	if projectID == "" {
		response.WriteInvalidRequest(w, "Project ID is required")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB limit
	var insight types.Insight
	if err := json.NewDecoder(r.Body).Decode(&insight); err != nil {
		response.WriteInvalidRequest(w, "Invalid JSON body")
		return
	}

	if err := h.service.CreateInsight(projectID, insight); err != nil {
		response.WriteInternalError(w, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, insight)
}
