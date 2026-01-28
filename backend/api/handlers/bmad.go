package handlers

import (
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
)

// BMadHandler handles BMAD-related API endpoints
type BMadHandler struct {
	configService      *services.BMadConfigService
	workflowPathService *services.WorkflowPathService
}

// NewBMadHandler creates a new BMadHandler with the given services
func NewBMadHandler(cs *services.BMadConfigService, wps *services.WorkflowPathService) *BMadHandler {
	return &BMadHandler{
		configService:      cs,
		workflowPathService: wps,
	}
}

// GetConfig handles GET /api/v1/bmad/config
func (h *BMadHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	config := h.configService.GetConfig()
	if config == nil {
		response.WriteError(w, "bmad_not_installed", "BMAD configuration not loaded. Ensure the project has _bmad/bmm/config.yaml.", http.StatusServiceUnavailable)
		return
	}

	response.WriteJSON(w, http.StatusOK, config)
}

// GetPhases handles GET /api/v1/bmad/phases
func (h *BMadHandler) GetPhases(w http.ResponseWriter, r *http.Request) {
	if h.workflowPathService == nil {
		response.WriteError(w, "path_files_not_found", "Workflow path service not available.", http.StatusServiceUnavailable)
		return
	}

	phases, err := h.workflowPathService.GetPhases()
	if err != nil {
		pathErr, ok := err.(*services.WorkflowPathError)
		if ok {
			response.WriteError(w, pathErr.Code, pathErr.Message, http.StatusServiceUnavailable)
			return
		}
		response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		return
	}

	response.WriteJSON(w, http.StatusOK, phases)
}
