package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"bmad-studio/backend/services"

	"github.com/go-chi/chi/v5"
)

func newTestProviderHandler() *ProviderHandler {
	return NewProviderHandler(services.NewProviderService())
}

// --- ValidateProvider handler tests ---

func TestProviderHandler_ValidateProvider_MissingType(t *testing.T) {
	h := newTestProviderHandler()

	body := `{"api_key": "sk-ant-test"}`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.ValidateProvider(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Errorf("Expected 422, got %d", rr.Code)
	}
}

func TestProviderHandler_ValidateProvider_MissingAPIKey(t *testing.T) {
	h := newTestProviderHandler()

	body := `{"type": "claude"}`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.ValidateProvider(rr, req)

	if rr.Code != http.StatusUnprocessableEntity {
		t.Errorf("Expected 422, got %d", rr.Code)
	}
}

func TestProviderHandler_ValidateProvider_InvalidJSON(t *testing.T) {
	h := newTestProviderHandler()

	body := `not json`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.ValidateProvider(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", rr.Code)
	}
}

func TestProviderHandler_ValidateProvider_UnsupportedType(t *testing.T) {
	h := newTestProviderHandler()

	body := `{"type": "unsupported", "api_key": "test"}`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.ValidateProvider(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for unsupported type, got %d", rr.Code)
	}
}

func TestProviderHandler_ValidateProvider_ErrorResponseFormat(t *testing.T) {
	h := newTestProviderHandler()

	body := `{"type": "claude"}`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.ValidateProvider(rr, req)

	var errResp struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}
	if errResp.Error.Code == "" {
		t.Error("Error response should have error code")
	}
	if errResp.Error.Message == "" {
		t.Error("Error response should have error message")
	}
}

// --- ListModels handler tests ---

func TestProviderHandler_ListModels_Claude(t *testing.T) {
	h := newTestProviderHandler()

	// Use chi context to provide URL param
	req, _ := http.NewRequest("GET", "/api/v1/providers/claude/models", nil)
	rr := httptest.NewRecorder()

	// Need to use chi router to properly set URL params
	router := setupProviderRoutes(h)
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var models []struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Provider string `json:"provider"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&models); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(models) != 3 {
		t.Fatalf("Expected 3 models, got %d", len(models))
	}

	// Verify all models are Claude models
	for _, m := range models {
		if m.Provider != "claude" {
			t.Errorf("Expected provider 'claude', got %q", m.Provider)
		}
	}
}

func TestProviderHandler_ListModels_UnsupportedType(t *testing.T) {
	h := newTestProviderHandler()

	req, _ := http.NewRequest("GET", "/api/v1/providers/unknown/models", nil)
	rr := httptest.NewRecorder()

	router := setupProviderRoutes(h)
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", rr.Code)
	}
}

func TestProviderHandler_ListModels_ResponseFormat(t *testing.T) {
	h := newTestProviderHandler()

	req, _ := http.NewRequest("GET", "/api/v1/providers/claude/models", nil)
	rr := httptest.NewRecorder()

	router := setupProviderRoutes(h)
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", rr.Code)
	}

	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}

	var models []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Provider  string `json:"provider"`
		MaxTokens int    `json:"max_tokens"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&models); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	for _, m := range models {
		if m.ID == "" {
			t.Error("Model should have non-empty ID")
		}
		if m.Name == "" {
			t.Error("Model should have non-empty Name")
		}
		if m.MaxTokens <= 0 {
			t.Error("Model should have positive MaxTokens")
		}
	}
}

// --- NFR6: Security test ---

func TestProviderHandler_ValidateProvider_NoKeyInResponse(t *testing.T) {
	h := newTestProviderHandler()

	apiKey := "sk-ant-very-secret-key-12345"
	body := `{"type": "unsupported", "api_key": "` + apiKey + `"}`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	h.ValidateProvider(rr, req)

	responseBody := rr.Body.String()
	if strings.Contains(responseBody, apiKey) {
		t.Errorf("Response body should not contain API key. Got: %s", responseBody)
	}
}

// setupProviderRoutes creates a chi router with provider routes for testing.
func setupProviderRoutes(h *ProviderHandler) http.Handler {
	r := chi.NewRouter()
	r.Route("/api/v1/providers", func(r chi.Router) {
		r.Post("/validate", h.ValidateProvider)
		r.Get("/{type}/models", h.ListModels)
	})
	return r
}
