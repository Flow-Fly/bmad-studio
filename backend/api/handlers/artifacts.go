package handlers

import (
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"bmad-studio/backend/types"

	"github.com/go-chi/chi/v5"
)

// ArtifactHandler handles artifact-related API requests
type ArtifactHandler struct {
	artifactService *services.ArtifactService
}

// NewArtifactHandler creates a new ArtifactHandler instance
func NewArtifactHandler(artifactService *services.ArtifactService) *ArtifactHandler {
	return &ArtifactHandler{
		artifactService: artifactService,
	}
}

// writeArtifactError maps ArtifactServiceError codes to HTTP status codes and writes the response.
// Returns true if the error was handled, false if the caller should use a generic fallback.
func writeArtifactError(w http.ResponseWriter, err error) bool {
	svcErr, ok := err.(*services.ArtifactServiceError)
	if !ok {
		return false
	}

	var status int
	switch svcErr.Code {
	case services.ErrCodeArtifactNotFound:
		status = http.StatusNotFound
	case services.ErrCodeArtifactConfigNotLoaded, services.ErrCodeArtifactsNotLoaded:
		status = http.StatusServiceUnavailable
	default:
		return false
	}

	response.WriteError(w, svcErr.Code, svcErr.Message, status)
	return true
}

// GetArtifacts handles GET /api/v1/bmad/artifacts
func (h *ArtifactHandler) GetArtifacts(w http.ResponseWriter, r *http.Request) {
	artifacts, err := h.artifactService.GetArtifacts()
	if err != nil {
		if !writeArtifactError(w, err) {
			response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		}
		return
	}

	response.WriteJSON(w, http.StatusOK, types.ArtifactsResponse{Artifacts: artifacts})
}

// GetArtifact handles GET /api/v1/bmad/artifacts/{id}
func (h *ArtifactHandler) GetArtifact(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	artifact, err := h.artifactService.GetArtifact(id)
	if err != nil {
		if !writeArtifactError(w, err) {
			response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		}
		return
	}

	response.WriteJSON(w, http.StatusOK, artifact)
}
