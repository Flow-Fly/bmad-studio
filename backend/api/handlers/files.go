package handlers

import (
	"net/http"
	"strings"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"

	"github.com/go-chi/chi/v5"
)

// FileHandler handles file-related API endpoints for project files.
type FileHandler struct {
	service *services.FileService
}

// NewFileHandler creates a new FileHandler with the given service.
func NewFileHandler(service *services.FileService) *FileHandler {
	return &FileHandler{service: service}
}

// ListFiles handles GET /api/v1/projects/{id}/files.
// Returns all files under the project's _bmad-output/ directory.
func (h *FileHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
	files, err := h.service.ListProjectFiles()
	if err != nil {
		response.WriteInternalError(w, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, files)
}

// ReadFile handles GET /api/v1/projects/{id}/files/*.
// Returns the content of a specific file as plain text.
func (h *FileHandler) ReadFile(w http.ResponseWriter, r *http.Request) {
	filePath := chi.URLParam(r, "*")
	if filePath == "" {
		response.WriteInvalidRequest(w, "File path is required")
		return
	}

	content, err := h.service.ReadProjectFile(filePath)
	if err != nil {
		if strings.Contains(err.Error(), "traversal") || strings.Contains(err.Error(), "outside") {
			response.WriteInvalidRequest(w, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not found") {
			response.WriteNotFound(w, "File not found")
			return
		}
		response.WriteInternalError(w, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(content))
}
