package handlers

import (
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/services"
	"bmad-studio/backend/types"

	"github.com/go-chi/chi/v5"
)

// BMadHandler handles BMAD-related API endpoints
type BMadHandler struct {
	configService       *services.BMadConfigService
	workflowPathService *services.WorkflowPathService
	agentService        *services.AgentService
}

// NewBMadHandler creates a new BMadHandler with the given services
func NewBMadHandler(cs *services.BMadConfigService, wps *services.WorkflowPathService, as *services.AgentService) *BMadHandler {
	return &BMadHandler{
		configService:       cs,
		workflowPathService: wps,
		agentService:        as,
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

// GetAgents handles GET /api/v1/bmad/agents
func (h *BMadHandler) GetAgents(w http.ResponseWriter, r *http.Request) {
	if h.agentService == nil {
		response.WriteError(w, "agents_not_loaded", "Agent service not available.", http.StatusServiceUnavailable)
		return
	}

	agents, err := h.agentService.GetAgents()
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
	if h.agentService == nil {
		response.WriteError(w, "agents_not_loaded", "Agent service not available.", http.StatusServiceUnavailable)
		return
	}

	agentID := chi.URLParam(r, "id")
	agent, err := h.agentService.GetAgent(agentID)
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
