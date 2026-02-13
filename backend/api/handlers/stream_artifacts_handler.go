package handlers

import (
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"github.com/go-chi/chi/v5"
)

// StreamArtifactsHandler handles artifact listing and reading for streams.
type StreamArtifactsHandler struct {
	artifactService *services.StreamArtifactService
}

// NewStreamArtifactsHandler creates a new StreamArtifactsHandler.
func NewStreamArtifactsHandler(artifactService *services.StreamArtifactService) *StreamArtifactsHandler {
	return &StreamArtifactsHandler{artifactService: artifactService}
}

// ListArtifacts handles GET /projects/:id/streams/:sid/artifacts
func (h *StreamArtifactsHandler) ListArtifacts(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamName := extractStreamName(w, projectName, chi.URLParam(r, "sid"))
	if streamName == "" {
		return
	}

	artifacts, err := h.artifactService.ListArtifacts(projectName, streamName)
	if err != nil {
		writeStreamServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, artifacts)
}

// ReadArtifact handles GET /projects/:id/streams/:sid/artifacts/*
func (h *StreamArtifactsHandler) ReadArtifact(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamName := extractStreamName(w, projectName, chi.URLParam(r, "sid"))
	if streamName == "" {
		return
	}

	artifactPath := chi.URLParam(r, "*")
	if artifactPath == "" {
		response.WriteInvalidRequest(w, "Missing artifact path")
		return
	}

	content, err := h.artifactService.ReadArtifact(projectName, streamName, artifactPath)
	if err != nil {
		writeStreamServiceError(w, err)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(content))
}
