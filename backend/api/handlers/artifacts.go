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

// GetArtifacts handles GET /api/v1/bmad/artifacts
func (h *ArtifactHandler) GetArtifacts(w http.ResponseWriter, r *http.Request) {
	artifacts, err := h.artifactService.GetArtifacts()
	if err != nil {
		if svcErr, ok := err.(*services.ArtifactServiceError); ok {
			switch svcErr.Code {
			case services.ErrCodeArtifactConfigNotLoaded, services.ErrCodeArtifactsNotLoaded:
				response.WriteError(w, svcErr.Code, svcErr.Message, http.StatusServiceUnavailable)
				return
			}
		}
		response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		return
	}

	response.WriteJSON(w, http.StatusOK, types.ArtifactsResponse{Artifacts: artifacts})
}

// GetArtifact handles GET /api/v1/bmad/artifacts/{id}
func (h *ArtifactHandler) GetArtifact(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	artifact, err := h.artifactService.GetArtifact(id)
	if err != nil {
		if svcErr, ok := err.(*services.ArtifactServiceError); ok {
			switch svcErr.Code {
			case services.ErrCodeArtifactNotFound:
				response.WriteError(w, svcErr.Code, svcErr.Message, http.StatusNotFound)
				return
			case services.ErrCodeArtifactConfigNotLoaded, services.ErrCodeArtifactsNotLoaded:
				response.WriteError(w, svcErr.Code, svcErr.Message, http.StatusServiceUnavailable)
				return
			}
		}
		response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		return
	}

	response.WriteJSON(w, http.StatusOK, artifact)
}
