package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"bmad-studio/backend/types"

	"github.com/go-chi/chi/v5"
)

// ProjectHandler handles legacy project-related API endpoints (OpenProject).
type ProjectHandler struct {
	projectManager *services.ProjectManager
}

// NewProjectHandler creates a new ProjectHandler with the given ProjectManager.
func NewProjectHandler(pm *services.ProjectManager) *ProjectHandler {
	return &ProjectHandler{projectManager: pm}
}

// OpenProject handles POST /api/v1/projects/open
func (h *ProjectHandler) OpenProject(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
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

// ProjectsHandler handles project registration and management API endpoints.
type ProjectsHandler struct {
	service projectServiceAdapter
}

// ProjectService interface defines the contract for project operations
type ProjectService interface {
	Register(repoPath string) (interface{}, error)
	Unregister(projectName string) error
	List() (interface{}, error)
	Get(projectName string) (interface{}, error)
}

// projectServiceAdapter wraps services.ProjectService to match the interface
type projectServiceAdapter struct {
	svc interface {
		Register(repoPath string) (*types.RegistryEntry, error)
		Unregister(projectName string) error
		List() ([]types.RegistryEntry, error)
		Get(projectName string) (*types.ProjectMeta, error)
	}
}

func (a projectServiceAdapter) Register(repoPath string) (interface{}, error) {
	return a.svc.Register(repoPath)
}

func (a projectServiceAdapter) Unregister(projectName string) error {
	return a.svc.Unregister(projectName)
}

func (a projectServiceAdapter) List() (interface{}, error) {
	return a.svc.List()
}

func (a projectServiceAdapter) Get(projectName string) (interface{}, error) {
	return a.svc.Get(projectName)
}

// NewProjectsHandler creates a new ProjectsHandler with the given ProjectService.
// Accepts either the adapter interface or the concrete services.ProjectService type.
func NewProjectsHandler(svc interface{}) *ProjectsHandler {
	// If it's already the adapter interface, use it directly
	if adapted, ok := svc.(ProjectService); ok {
		// For test mocks that already implement ProjectService
		return &ProjectsHandler{service: projectServiceAdapter{svc: &mockWrapper{adapted}}}
	}

	// Otherwise wrap the concrete service
	type concreteService interface {
		Register(repoPath string) (*types.RegistryEntry, error)
		Unregister(projectName string) error
		List() ([]types.RegistryEntry, error)
		Get(projectName string) (*types.ProjectMeta, error)
	}

	if concrete, ok := svc.(concreteService); ok {
		return &ProjectsHandler{service: projectServiceAdapter{svc: concrete}}
	}

	panic("invalid service type provided to NewProjectsHandler")
}

// mockWrapper helps test mocks work with the adapter
type mockWrapper struct {
	ProjectService
}

func (m *mockWrapper) Register(repoPath string) (*types.RegistryEntry, error) {
	result, err := m.ProjectService.Register(repoPath)
	if result == nil {
		return nil, err
	}
	if entry, ok := result.(*types.RegistryEntry); ok {
		return entry, err
	}
	return nil, err
}

func (m *mockWrapper) Unregister(projectName string) error {
	return m.ProjectService.Unregister(projectName)
}

func (m *mockWrapper) List() ([]types.RegistryEntry, error) {
	result, err := m.ProjectService.List()
	if result == nil {
		return nil, err
	}
	if entries, ok := result.([]types.RegistryEntry); ok {
		return entries, err
	}
	return nil, err
}

func (m *mockWrapper) Get(projectName string) (*types.ProjectMeta, error) {
	result, err := m.ProjectService.Get(projectName)
	if result == nil {
		return nil, err
	}
	if meta, ok := result.(*types.ProjectMeta); ok {
		return meta, err
	}
	return nil, err
}

// RegisterProject handles POST /projects
func (h *ProjectsHandler) RegisterProject(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	var req struct {
		RepoPath string `json:"repoPath"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInvalidRequest(w, "Invalid request body")
		return
	}

	if req.RepoPath == "" {
		response.WriteInvalidRequest(w, "repoPath is required")
		return
	}

	entry, err := h.service.Register(req.RepoPath)
	if err != nil {
		h.handleServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusCreated, entry)
}

// ListProjects handles GET /projects
func (h *ProjectsHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	entries, err := h.service.List()
	if err != nil {
		response.WriteInternalError(w, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, entries)
}

// GetProject handles GET /projects/{id}
func (h *ProjectsHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	meta, err := h.service.Get(projectID)
	if err != nil {
		h.handleServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, meta)
}

// UnregisterProject handles DELETE /projects/{id}
func (h *ProjectsHandler) UnregisterProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	err := h.service.Unregister(projectID)
	if err != nil {
		h.handleServiceError(w, err)
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "Project unregistered successfully",
	})
}

// handleServiceError maps ProjectService errors to appropriate HTTP responses
func (h *ProjectsHandler) handleServiceError(w http.ResponseWriter, err error) {
	errMsg := err.Error()

	// Map error strings to HTTP status codes per Dev Notes error mapping table
	switch {
	case strings.Contains(errMsg, "already registered"):
		response.WriteError(w, response.ErrCodeAlreadyExists, errMsg, http.StatusConflict)
	case strings.Contains(errMsg, "not a git repository"):
		response.WriteInvalidRequest(w, errMsg)
	case strings.Contains(errMsg, "not a directory"):
		response.WriteInvalidRequest(w, errMsg)
	case strings.Contains(errMsg, "validate path"):
		response.WriteInvalidRequest(w, errMsg)
	case os.IsNotExist(err):
		response.WriteInvalidRequest(w, errMsg)
	case strings.Contains(errMsg, "not found"):
		response.WriteNotFound(w, errMsg)
	default:
		response.WriteInternalError(w, errMsg)
	}
}
