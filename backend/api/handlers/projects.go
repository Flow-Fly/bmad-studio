package handlers

import (
	"encoding/json"
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
)

// ProjectHandler handles project-related API endpoints.
type ProjectHandler struct {
	projectManager *services.ProjectManager
}

// NewProjectHandler creates a new ProjectHandler with the given ProjectManager.
func NewProjectHandler(pm *services.ProjectManager) *ProjectHandler {
	return &ProjectHandler{projectManager: pm}
}

// OpenProject handles POST /api/v1/projects/open
func (h *ProjectHandler) OpenProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInvalidRequest(w, "Invalid request body")
		return
	}

	if req.Path == "" {
		response.WriteInvalidRequest(w, "Path is required")
		return
	}

	info, err := h.projectManager.LoadProject(req.Path)
	if err != nil {
		if projectErr, ok := err.(*services.ProjectError); ok {
			switch projectErr.Code {
			case "path_not_found", "path_not_directory":
				response.WriteError(w, projectErr.Code, projectErr.Message, http.StatusBadRequest)
			case "bmad_not_found":
				response.WriteError(w, projectErr.Code, projectErr.Message, http.StatusServiceUnavailable)
			case "bmad_config_invalid":
				response.WriteError(w, projectErr.Code, projectErr.Message, http.StatusUnprocessableEntity)
			default:
				response.WriteError(w, projectErr.Code, projectErr.Message, http.StatusInternalServerError)
			}
			return
		}
		response.WriteInternalError(w, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, info)
}

// ListProjects handles GET /api/v1/projects
func ListProjects(w http.ResponseWriter, _ *http.Request) {
	response.WriteNotImplemented(w)
}

// CreateProject handles POST /api/v1/projects
func CreateProject(w http.ResponseWriter, _ *http.Request) {
	response.WriteNotImplemented(w)
}

// GetProject handles GET /api/v1/projects/{id}
func GetProject(w http.ResponseWriter, _ *http.Request) {
	response.WriteNotImplemented(w)
}

// UpdateProject handles PUT /api/v1/projects/{id}
func UpdateProject(w http.ResponseWriter, _ *http.Request) {
	response.WriteNotImplemented(w)
}
