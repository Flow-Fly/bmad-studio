package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"bmad-studio/backend/api"
	"bmad-studio/backend/services"
)

func newRouterWithProvider() http.Handler {
	return api.NewRouterWithServices(api.RouterServices{
		Provider: services.NewProviderService(),
	})
}

// --- Integration: Provider validate endpoint ---

func TestIntegration_ProviderValidate_MissingFields(t *testing.T) {
	router := newRouterWithProvider()

	tests := []struct {
		name         string
		body         string
		expectedCode int
	}{
		{"missing type", `{"api_key":"test"}`, http.StatusUnprocessableEntity},
		{"missing api_key", `{"type":"claude"}`, http.StatusUnprocessableEntity},
		{"empty body", `{}`, http.StatusUnprocessableEntity},
		{"invalid json", `not json`, http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != tt.expectedCode {
				t.Errorf("Expected %d, got %d. Body: %s", tt.expectedCode, rr.Code, rr.Body.String())
			}
		})
	}
}

func TestIntegration_ProviderValidate_UnsupportedProvider(t *testing.T) {
	router := newRouterWithProvider()

	body := `{"type":"openai","api_key":"test-key"}`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for unsupported provider, got %d", rr.Code)
	}

	var errResp struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	json.NewDecoder(rr.Body).Decode(&errResp)
	if errResp.Error.Code != "invalid_request" {
		t.Errorf("Expected error code 'invalid_request', got %q", errResp.Error.Code)
	}
}

// --- Integration: Provider models endpoint ---

func TestIntegration_ProviderModels_Claude(t *testing.T) {
	router := newRouterWithProvider()

	req, _ := http.NewRequest("GET", "/api/v1/providers/claude/models", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var models []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Provider  string `json:"provider"`
		MaxTokens int    `json:"max_tokens"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&models); err != nil {
		t.Fatalf("Failed to decode: %v", err)
	}

	if len(models) != 3 {
		t.Fatalf("Expected 3 models, got %d", len(models))
	}

	expectedIDs := map[string]bool{
		"claude-opus-4-5-20251101":   false,
		"claude-sonnet-4-5-20250929": false,
		"claude-haiku-4-5-20251001":  false,
	}

	for _, m := range models {
		if _, ok := expectedIDs[m.ID]; !ok {
			t.Errorf("Unexpected model ID: %s", m.ID)
		}
		expectedIDs[m.ID] = true
	}

	for id, found := range expectedIDs {
		if !found {
			t.Errorf("Expected model ID %s not found", id)
		}
	}
}

func TestIntegration_ProviderModels_UnsupportedType(t *testing.T) {
	router := newRouterWithProvider()

	req, _ := http.NewRequest("GET", "/api/v1/providers/unknown/models", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400, got %d", rr.Code)
	}
}

// --- Integration: Existing endpoints still work ---

func TestIntegration_ProviderListStillPlaceholder(t *testing.T) {
	router := newRouterWithProvider()

	req, _ := http.NewRequest("GET", "/api/v1/providers", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotImplemented {
		t.Errorf("GET /api/v1/providers should still be 501 placeholder, got %d", rr.Code)
	}
}

func TestIntegration_ProviderAddStillPlaceholder(t *testing.T) {
	router := newRouterWithProvider()

	req, _ := http.NewRequest("POST", "/api/v1/providers", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotImplemented {
		t.Errorf("POST /api/v1/providers should still be 501 placeholder, got %d", rr.Code)
	}
}

// --- NFR6: Security integration test ---

func TestIntegration_ProviderValidate_APIKeyNotInResponse(t *testing.T) {
	router := newRouterWithProvider()

	apiKey := "sk-ant-super-secret-key-xyz123"
	body := `{"type":"claude","api_key":"` + apiKey + `"}`
	req, _ := http.NewRequest("POST", "/api/v1/providers/validate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	responseBody := rr.Body.String()
	if strings.Contains(responseBody, apiKey) {
		t.Errorf("Response should not contain API key")
	}
}
