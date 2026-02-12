package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"bmad-studio/backend/services"
	"github.com/go-chi/chi/v5"
)

type StreamsHandler struct {
	streamService *services.StreamService
}

func NewStreamsHandler(streamService *services.StreamService) *StreamsHandler {
	return &StreamsHandler{streamService: streamService}
}

// CreateStream handles POST /projects/:id/streams
func (h *StreamsHandler) CreateStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "invalid_request", "Missing required field: name")
		return
	}

	meta, err := h.streamService.Create(projectName, req.Name)
	if err != nil {
		respondError(w, statusCodeFromError(err), errorCodeFromError(err), err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, meta)
}

// ListStreams handles GET /projects/:id/streams
func (h *StreamsHandler) ListStreams(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")

	streams, err := h.streamService.List(projectName)
	if err != nil {
		respondError(w, statusCodeFromError(err), errorCodeFromError(err), err.Error())
		return
	}

	respondJSON(w, http.StatusOK, streams)
}

// GetStream handles GET /projects/:id/streams/:sid
func (h *StreamsHandler) GetStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamID := chi.URLParam(r, "sid")

	// Parse streamID to extract streamName
	prefix := projectName + "-"
	if !strings.HasPrefix(streamID, prefix) {
		respondError(w, http.StatusBadRequest, "invalid_stream_id", fmt.Sprintf("Stream ID must start with '%s'", prefix))
		return
	}
	streamName := strings.TrimPrefix(streamID, prefix)

	meta, err := h.streamService.Get(projectName, streamName)
	if err != nil {
		respondError(w, statusCodeFromError(err), errorCodeFromError(err), err.Error())
		return
	}

	respondJSON(w, http.StatusOK, meta)
}

// UpdateStream handles PUT /projects/:id/streams/:sid
func (h *StreamsHandler) UpdateStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamID := chi.URLParam(r, "sid")

	// Parse streamID to extract streamName
	prefix := projectName + "-"
	if !strings.HasPrefix(streamID, prefix) {
		respondError(w, http.StatusBadRequest, "invalid_stream_id", fmt.Sprintf("Stream ID must start with '%s'", prefix))
		return
	}
	streamName := strings.TrimPrefix(streamID, prefix)

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON")
		return
	}

	meta, err := h.streamService.UpdateMetadata(projectName, streamName, updates)
	if err != nil {
		respondError(w, statusCodeFromError(err), errorCodeFromError(err), err.Error())
		return
	}

	respondJSON(w, http.StatusOK, meta)
}

// ArchiveStream handles POST /projects/:id/streams/:sid/archive
func (h *StreamsHandler) ArchiveStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamID := chi.URLParam(r, "sid")

	// Parse streamID to extract streamName
	prefix := projectName + "-"
	if !strings.HasPrefix(streamID, prefix) {
		respondError(w, http.StatusBadRequest, "invalid_stream_id", fmt.Sprintf("Stream ID must start with '%s'", prefix))
		return
	}
	streamName := strings.TrimPrefix(streamID, prefix)

	var req struct {
		Outcome string `json:"outcome"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON")
		return
	}

	if req.Outcome != "merged" && req.Outcome != "abandoned" {
		respondError(w, http.StatusBadRequest, "invalid_outcome", "Outcome must be 'merged' or 'abandoned'")
		return
	}

	meta, err := h.streamService.Archive(projectName, streamName, req.Outcome)
	if err != nil {
		respondError(w, statusCodeFromError(err), errorCodeFromError(err), err.Error())
		return
	}

	respondJSON(w, http.StatusOK, meta)
}

// Helper functions

func respondError(w http.ResponseWriter, statusCode int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func statusCodeFromError(err error) int {
	errMsg := err.Error()
	if strings.Contains(errMsg, "not found") {
		return http.StatusNotFound
	}
	if strings.Contains(errMsg, "already exists") || strings.Contains(errMsg, "already archived") {
		return http.StatusConflict
	}
	if strings.Contains(errMsg, "invalid") {
		return http.StatusBadRequest
	}
	return http.StatusInternalServerError
}

func errorCodeFromError(err error) string {
	errMsg := err.Error()
	if strings.Contains(errMsg, "not found") {
		return "not_found"
	}
	if strings.Contains(errMsg, "already exists") {
		return "conflict"
	}
	if strings.Contains(errMsg, "already archived") {
		return "already_archived"
	}
	if strings.Contains(errMsg, "invalid") {
		return "invalid_request"
	}
	return "internal_error"
}
