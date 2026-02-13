package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"github.com/go-chi/chi/v5"
)

// StreamsHandler handles stream lifecycle API endpoints.
type StreamsHandler struct {
	streamService *services.StreamService
}

// NewStreamsHandler creates a new StreamsHandler with the given service.
func NewStreamsHandler(streamService *services.StreamService) *StreamsHandler {
	return &StreamsHandler{streamService: streamService}
}

// extractStreamName parses a composite stream ID ("{project}-{stream}") and returns
// the stream name portion. Writes a 400 error and returns "" if the format is invalid.
func extractStreamName(w http.ResponseWriter, projectName, streamID string) string {
	prefix := projectName + "-"
	if !strings.HasPrefix(streamID, prefix) {
		response.WriteInvalidRequest(w, fmt.Sprintf("Stream ID must start with '%s'", prefix))
		return ""
	}
	return strings.TrimPrefix(streamID, prefix)
}

// writeStreamServiceError maps stream service errors to appropriate HTTP responses.
func writeStreamServiceError(w http.ResponseWriter, err error) {
	errMsg := err.Error()
	switch {
	case strings.Contains(errMsg, "unmerged changes"):
		response.WriteError(w, "conflict", errMsg, http.StatusConflict)
	case strings.Contains(errMsg, "not found"):
		response.WriteNotFound(w, errMsg)
	case strings.Contains(errMsg, "already exists"), strings.Contains(errMsg, "already archived"):
		response.WriteError(w, "conflict", errMsg, http.StatusConflict)
	case strings.Contains(errMsg, "invalid"):
		response.WriteInvalidRequest(w, errMsg)
	default:
		response.WriteInternalError(w, errMsg)
	}
}

// CreateStream handles POST /projects/:id/streams
func (h *StreamsHandler) CreateStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInvalidRequest(w, "Invalid JSON")
		return
	}

	if req.Name == "" {
		response.WriteInvalidRequest(w, "Missing required field: name")
		return
	}

	meta, err := h.streamService.Create(projectName, req.Name)
	if err != nil {
		writeStreamServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusCreated, meta)
}

// ListStreams handles GET /projects/:id/streams
func (h *StreamsHandler) ListStreams(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")

	streams, err := h.streamService.List(projectName)
	if err != nil {
		writeStreamServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, streams)
}

// GetStream handles GET /projects/:id/streams/:sid
func (h *StreamsHandler) GetStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamName := extractStreamName(w, projectName, chi.URLParam(r, "sid"))
	if streamName == "" {
		return
	}

	meta, err := h.streamService.Get(projectName, streamName)
	if err != nil {
		writeStreamServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, meta)
}

// UpdateStream handles PUT /projects/:id/streams/:sid
func (h *StreamsHandler) UpdateStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamName := extractStreamName(w, projectName, chi.URLParam(r, "sid"))
	if streamName == "" {
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		response.WriteInvalidRequest(w, "Invalid JSON")
		return
	}

	meta, err := h.streamService.UpdateMetadata(projectName, streamName, updates)
	if err != nil {
		writeStreamServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, meta)
}

// ArchiveStream handles POST /projects/:id/streams/:sid/archive
func (h *StreamsHandler) ArchiveStream(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamName := extractStreamName(w, projectName, chi.URLParam(r, "sid"))
	if streamName == "" {
		return
	}

	var req struct {
		Outcome string `json:"outcome"`
		Force   bool   `json:"force"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInvalidRequest(w, "Invalid JSON")
		return
	}

	if req.Outcome != "merged" && req.Outcome != "abandoned" {
		response.WriteInvalidRequest(w, "Outcome must be 'merged' or 'abandoned'")
		return
	}

	meta, err := h.streamService.Archive(projectName, streamName, req.Outcome, req.Force)
	if err != nil {
		writeStreamServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, meta)
}
