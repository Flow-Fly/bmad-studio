package handlers

import (
	"encoding/json"
	"net/http"

	"bmad-studio/backend/api/response"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

var validProviders = map[string]bool{
	"claude": true,
	"openai": true,
	"ollama": true,
}

// SettingsHandler handles settings-related API endpoints.
type SettingsHandler struct {
	store *storage.ConfigStore
}

// NewSettingsHandler creates a new SettingsHandler with the given config store.
func NewSettingsHandler(store *storage.ConfigStore) *SettingsHandler {
	return &SettingsHandler{store: store}
}

// GetSettings handles GET /api/v1/settings.
func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.store.Load()
	if err != nil {
		response.WriteInternalError(w, "Failed to load settings")
		return
	}
	response.WriteJSON(w, http.StatusOK, settings)
}

// UpdateSettings handles PUT /api/v1/settings.
func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req types.Settings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInvalidRequest(w, "Invalid request body")
		return
	}

	// Validate provider name if provided
	if req.DefaultProvider != "" && !validProviders[req.DefaultProvider] {
		response.WriteInvalidRequest(w, "Invalid provider. Must be one of: claude, openai, ollama")
		return
	}

	// Validate provider keys in providers map
	if req.Providers != nil {
		for k := range req.Providers {
			if !validProviders[k] {
				response.WriteInvalidRequest(w, "Invalid provider key: "+k)
				return
			}
		}
	}

	var result types.Settings
	err := h.store.Update(func(current *types.Settings) {
		if req.DefaultProvider != "" {
			current.DefaultProvider = req.DefaultProvider
		}
		if req.DefaultModel != "" {
			current.DefaultModel = req.DefaultModel
		}
		if req.OllamaEndpoint != "" {
			current.OllamaEndpoint = req.OllamaEndpoint
		}
		if req.Providers != nil {
			for k, v := range req.Providers {
				current.Providers[k] = v
			}
		}
		result = *current
	})
	if err != nil {
		response.WriteInternalError(w, "Failed to save settings")
		return
	}

	response.WriteJSON(w, http.StatusOK, result)
}
