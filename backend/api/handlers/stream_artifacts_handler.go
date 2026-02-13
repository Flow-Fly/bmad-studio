package handlers

import (
	"fmt"
	"net/http"
	"strings"

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
	streamID := chi.URLParam(r, "sid")

	// Parse streamID to extract streamName
	prefix := projectName + "-"
	if !strings.HasPrefix(streamID, prefix) {
		respondError(w, http.StatusBadRequest, "invalid_stream_id", fmt.Sprintf("Stream ID must start with '%s'", prefix))
		return
	}
	streamName := strings.TrimPrefix(streamID, prefix)

	artifacts, err := h.artifactService.ListArtifacts(projectName, streamName)
	if err != nil {
		respondError(w, statusCodeFromError(err), errorCodeFromError(err), err.Error())
		return
	}

	respondJSON(w, http.StatusOK, artifacts)
}

// ReadArtifact handles GET /projects/:id/streams/:sid/artifacts/*
func (h *StreamArtifactsHandler) ReadArtifact(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamID := chi.URLParam(r, "sid")

	// Parse streamID to extract streamName
	prefix := projectName + "-"
	if !strings.HasPrefix(streamID, prefix) {
		respondError(w, http.StatusBadRequest, "invalid_stream_id", fmt.Sprintf("Stream ID must start with '%s'", prefix))
		return
	}
	streamName := strings.TrimPrefix(streamID, prefix)

	artifactPath := chi.URLParam(r, "*")
	if artifactPath == "" {
		respondError(w, http.StatusBadRequest, "invalid_request", "Missing artifact path")
		return
	}

	content, err := h.artifactService.ReadArtifact(projectName, streamName, artifactPath)
	if err != nil {
		respondError(w, statusCodeFromError(err), errorCodeFromError(err), err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(content))
}
