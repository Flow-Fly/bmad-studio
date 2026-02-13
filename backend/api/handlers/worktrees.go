package handlers

import (
	"net/http"
	"strings"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"github.com/go-chi/chi/v5"
)

// WorktreesHandler handles worktree API endpoints.
type WorktreesHandler struct {
	worktreeService *services.WorktreeService
}

// NewWorktreesHandler creates a new WorktreesHandler with the given service.
func NewWorktreesHandler(worktreeService *services.WorktreeService) *WorktreesHandler {
	return &WorktreesHandler{worktreeService: worktreeService}
}

// writeWorktreeServiceError maps worktree service errors to appropriate HTTP responses.
func writeWorktreeServiceError(w http.ResponseWriter, err error) {
	errMsg := err.Error()
	switch {
	case strings.Contains(errMsg, "not found"):
		response.WriteNotFound(w, errMsg)
	case strings.Contains(errMsg, "already exists"), strings.Contains(errMsg, "already has worktree"), strings.Contains(errMsg, "not active"):
		response.WriteError(w, "conflict", errMsg, http.StatusConflict)
	case strings.Contains(errMsg, "git not available"):
		response.WriteInternalError(w, errMsg)
	default:
		response.WriteInternalError(w, errMsg)
	}
}

// CreateWorktree handles POST /projects/:id/streams/:sid/worktree
func (h *WorktreesHandler) CreateWorktree(w http.ResponseWriter, r *http.Request) {
	projectName := chi.URLParam(r, "id")
	streamName := extractStreamName(w, projectName, chi.URLParam(r, "sid"))
	if streamName == "" {
		return
	}

	result, err := h.worktreeService.Create(projectName, streamName)
	if err != nil {
		writeWorktreeServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusCreated, result)
}
