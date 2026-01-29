package handlers

import (
	"encoding/json"
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/providers"
	"bmad-studio/backend/services"

	"github.com/go-chi/chi/v5"
)

// ProviderHandler handles provider-related API endpoints.
type ProviderHandler struct {
	providerService *services.ProviderService
}

// NewProviderHandler creates a new ProviderHandler with the given service.
func NewProviderHandler(ps *services.ProviderService) *ProviderHandler {
	return &ProviderHandler{providerService: ps}
}

// validateRequest is the expected JSON body for POST /api/v1/providers/validate.
type validateRequest struct {
	Type   string `json:"type"`
	APIKey string `json:"api_key"`
}

// validateResponse is the JSON response for validation.
type validateResponse struct {
	Valid bool `json:"valid"`
}

// ValidateProvider handles POST /api/v1/providers/validate.
func (h *ProviderHandler) ValidateProvider(w http.ResponseWriter, r *http.Request) {
	var req validateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInvalidRequest(w, "Invalid request body")
		return
	}

	if req.Type == "" {
		response.WriteValidationError(w, "Provider type is required")
		return
	}
	if req.APIKey == "" {
		response.WriteValidationError(w, "API key is required")
		return
	}

	err := h.providerService.ValidateProvider(r.Context(), req.Type, req.APIKey)
	if err != nil {
		if pErr, ok := err.(*providers.ProviderError); ok {
			switch pErr.Code {
			case "unsupported_provider":
				response.WriteInvalidRequest(w, pErr.UserMessage)
			case "auth_error":
				response.WriteError(w, "auth_error", pErr.UserMessage, http.StatusUnauthorized)
			default:
				response.WriteInternalError(w, pErr.UserMessage)
			}
			return
		}
		response.WriteInternalError(w, "Failed to validate provider credentials")
		return
	}

	response.WriteJSON(w, http.StatusOK, validateResponse{Valid: true})
}

// ListModels handles GET /api/v1/providers/:type/models.
func (h *ProviderHandler) ListModels(w http.ResponseWriter, r *http.Request) {
	providerType := chi.URLParam(r, "type")
	if providerType == "" {
		response.WriteInvalidRequest(w, "Provider type is required")
		return
	}

	models, err := h.providerService.ListProviderModels(providerType)
	if err != nil {
		if pErr, ok := err.(*providers.ProviderError); ok {
			response.WriteInvalidRequest(w, pErr.UserMessage)
			return
		}
		response.WriteInternalError(w, "Failed to list models")
		return
	}

	response.WriteJSON(w, http.StatusOK, models)
}

// ListProviders handles GET /api/v1/providers (placeholder - to be implemented in future story).
func ListProviders(w http.ResponseWriter, r *http.Request) {
	response.WriteNotImplemented(w)
}

// AddProvider handles POST /api/v1/providers (placeholder - to be implemented in future story).
func AddProvider(w http.ResponseWriter, r *http.Request) {
	response.WriteNotImplemented(w)
}
