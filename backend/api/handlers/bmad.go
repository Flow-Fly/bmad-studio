package handlers

import (
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"bmad-studio/backend/types"

	"github.com/go-chi/chi/v5"
)

// ServiceProvider resolves BMAD services dynamically per request.
// *services.ProjectManager satisfies this interface.
type ServiceProvider interface {
	ConfigService() *services.BMadConfigService
	WorkflowPathService() *services.WorkflowPathService
	AgentService() *services.AgentService
	WorkflowStatusService() *services.WorkflowStatusService
	ArtifactService() *services.ArtifactService
}

// BMadHandler handles BMAD-related API endpoints
type BMadHandler struct {
	services ServiceProvider
}

// NewBMadHandler creates a new BMadHandler that resolves services dynamically
func NewBMadHandler(sp ServiceProvider) *BMadHandler {
	return &BMadHandler{
		services: sp,
	}
}

// GetConfig handles GET /api/v1/bmad/config
func (h *BMadHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	configService := h.services.ConfigService()
	if configService == nil {
		response.WriteError(w, "bmad_not_installed", "BMAD configuration not loaded. Ensure the project has _bmad/bmm/config.yaml.", http.StatusServiceUnavailable)
		return
	}

	config := configService.GetConfig()
	if config == nil {
		response.WriteError(w, "bmad_not_installed", "BMAD configuration not loaded. Ensure the project has _bmad/bmm/config.yaml.", http.StatusServiceUnavailable)
		return
	}

	response.WriteJSON(w, http.StatusOK, config)
}

// GetPhases handles GET /api/v1/bmad/phases
func (h *BMadHandler) GetPhases(w http.ResponseWriter, r *http.Request) {
	workflowPathService := h.services.WorkflowPathService()
	if workflowPathService == nil {
		response.WriteError(w, "path_files_not_found", "Workflow path service not available.", http.StatusServiceUnavailable)
		return
	}

	phases, err := workflowPathService.GetPhases()
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

// GetAgents handles GET /api/v1/bmad/agents
func (h *BMadHandler) GetAgents(w http.ResponseWriter, r *http.Request) {
	agentService := h.services.AgentService()
	if agentService == nil {
		response.WriteError(w, "agents_not_loaded", "Agent service not available.", http.StatusServiceUnavailable)
		return
	}

	agents, err := agentService.GetAgents()
	if err != nil {
		agentErr, ok := err.(*services.AgentServiceError)
		if ok {
			response.WriteError(w, agentErr.Code, agentErr.Message, http.StatusServiceUnavailable)
			return
		}
		response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		return
	}

	response.WriteJSON(w, http.StatusOK, types.AgentsResponse{Agents: agents})
}

// GetAgent handles GET /api/v1/bmad/agents/{id}
func (h *BMadHandler) GetAgent(w http.ResponseWriter, r *http.Request) {
	agentService := h.services.AgentService()
	if agentService == nil {
		response.WriteError(w, "agents_not_loaded", "Agent service not available.", http.StatusServiceUnavailable)
		return
	}

	agentID := chi.URLParam(r, "id")
	agent, err := agentService.GetAgent(agentID)
	if err != nil {
		agentErr, ok := err.(*services.AgentServiceError)
		if ok {
			if agentErr.Code == services.ErrCodeAgentNotFound {
				response.WriteError(w, agentErr.Code, agentErr.Message, http.StatusNotFound)
				return
			}
			response.WriteError(w, agentErr.Code, agentErr.Message, http.StatusServiceUnavailable)
			return
		}
		response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		return
	}

	response.WriteJSON(w, http.StatusOK, agent)
}

// GetStatus handles GET /api/v1/bmad/status
func (h *BMadHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	workflowStatusService := h.services.WorkflowStatusService()
	if workflowStatusService == nil {
		response.WriteError(w, "status_not_loaded", "Workflow status service not available.", http.StatusServiceUnavailable)
		return
	}

	status, err := workflowStatusService.GetStatus()
	if err != nil {
		statusErr, ok := err.(*services.WorkflowStatusError)
		if ok {
			response.WriteError(w, statusErr.Code, statusErr.Message, http.StatusServiceUnavailable)
			return
		}
		response.WriteError(w, "internal_error", err.Error(), http.StatusInternalServerError)
		return
	}

	response.WriteJSON(w, http.StatusOK, status)
}
