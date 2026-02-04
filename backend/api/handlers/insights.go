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

// ListInsights handles GET /api/v1/projects/{id}/insights.
func (h *InsightHandler) ListInsights(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	if projectID == "" {
		response.WriteInvalidRequest(w, "Project ID is required")
		return
	}

	insights, err := h.service.ListInsights(projectID)
	if err != nil {
		response.WriteInternalError(w, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, insights)
}

// GetInsight handles GET /api/v1/projects/{id}/insights/{insightId}.
func (h *InsightHandler) GetInsight(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	insightID := chi.URLParam(r, "insightId")
	if projectID == "" || insightID == "" {
		response.WriteInvalidRequest(w, "Project ID and Insight ID are required")
		return
	}

	insight, err := h.service.GetInsight(projectID, insightID)
	if err != nil {
		response.WriteNotFound(w, "Insight not found")
		return
	}

	response.WriteJSON(w, http.StatusOK, insight)
}

// UpdateInsight handles PUT /api/v1/projects/{id}/insights/{insightId}.
func (h *InsightHandler) UpdateInsight(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	insightID := chi.URLParam(r, "insightId")
	if projectID == "" || insightID == "" {
		response.WriteInvalidRequest(w, "Project ID and Insight ID are required")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB limit
	var insight types.Insight
	if err := json.NewDecoder(r.Body).Decode(&insight); err != nil {
		response.WriteInvalidRequest(w, "Invalid JSON body")
		return
	}

	insight.ID = insightID // Ensure ID matches URL param
	if err := h.service.UpdateInsight(projectID, insight); err != nil {
		response.WriteInternalError(w, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, insight)
}

// DeleteInsight handles DELETE /api/v1/projects/{id}/insights/{insightId}.
func (h *InsightHandler) DeleteInsight(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	insightID := chi.URLParam(r, "insightId")
	if projectID == "" || insightID == "" {
		response.WriteInvalidRequest(w, "Project ID and Insight ID are required")
		return
	}

	if err := h.service.DeleteInsight(projectID, insightID); err != nil {
		response.WriteNotFound(w, "Insight not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
