package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"bmad-studio/backend/api"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

func newRouterWithSettings(t *testing.T) http.Handler {
	t.Helper()
	cs := storage.NewConfigStoreWithPath(t.TempDir() + "/config.json")
	return api.NewRouterWithServices(api.RouterServices{
		ConfigStore: cs,
	})
}

func TestIntegration_GetSettings_ReturnsDefaults(t *testing.T) {
	router := newRouterWithSettings(t)

	req, _ := http.NewRequest("GET", "/api/v1/settings", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var s types.Settings
	if err := json.NewDecoder(rr.Body).Decode(&s); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if s.DefaultProvider != "claude" {
		t.Errorf("expected default provider 'claude', got %q", s.DefaultProvider)
	}
	if s.OllamaEndpoint != "http://localhost:11434" {
		t.Errorf("expected ollama endpoint, got %q", s.OllamaEndpoint)
	}
	if len(s.Providers) != 3 {
		t.Errorf("expected 3 providers, got %d", len(s.Providers))
	}
}

func TestIntegration_PutSettings_UpdatesAndReturns(t *testing.T) {
	router := newRouterWithSettings(t)

	body := `{"default_provider":"openai","default_model":"gpt-4o"}`
	req, _ := http.NewRequest("PUT", "/api/v1/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var s types.Settings
	if err := json.NewDecoder(rr.Body).Decode(&s); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	if s.DefaultProvider != "openai" {
		t.Errorf("expected 'openai', got %q", s.DefaultProvider)
	}
	if s.DefaultModel != "gpt-4o" {
		t.Errorf("expected 'gpt-4o', got %q", s.DefaultModel)
	}
	// Ollama endpoint should remain default (not updated)
	if s.OllamaEndpoint != "http://localhost:11434" {
		t.Errorf("expected default ollama endpoint, got %q", s.OllamaEndpoint)
	}
}

func TestIntegration_PutSettings_MergesProviders(t *testing.T) {
	router := newRouterWithSettings(t)

	body := `{"providers":{"openai":{"enabled":true}}}`
	req, _ := http.NewRequest("PUT", "/api/v1/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	// Now GET and verify the merge
	req2, _ := http.NewRequest("GET", "/api/v1/settings", nil)
	rr2 := httptest.NewRecorder()
	router.ServeHTTP(rr2, req2)

	var s types.Settings
	json.NewDecoder(rr2.Body).Decode(&s)

	if !s.Providers["openai"].Enabled {
		t.Error("expected openai to be enabled after merge")
	}
	// Claude should remain from defaults
	if _, ok := s.Providers["claude"]; !ok {
		t.Error("expected claude provider to still exist")
	}
}

func TestIntegration_PutSettings_InvalidJSON(t *testing.T) {
	router := newRouterWithSettings(t)

	req, _ := http.NewRequest("PUT", "/api/v1/settings", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestIntegration_PutSettings_InvalidProvider(t *testing.T) {
	router := newRouterWithSettings(t)

	body := `{"default_provider":"invalid-provider"}`
	req, _ := http.NewRequest("PUT", "/api/v1/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid provider, got %d", rr.Code)
	}
}

func TestIntegration_PutSettings_InvalidProviderKey(t *testing.T) {
	router := newRouterWithSettings(t)

	body := `{"providers":{"invalid-provider":{"enabled":true}}}`
	req, _ := http.NewRequest("PUT", "/api/v1/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid provider key, got %d", rr.Code)
	}
}

func TestIntegration_PutSettings_Persistence(t *testing.T) {
	router := newRouterWithSettings(t)

	// PUT an update
	body := `{"default_provider":"ollama","default_model":"llama3","ollama_endpoint":"http://custom:1234"}`
	req, _ := http.NewRequest("PUT", "/api/v1/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("PUT expected 200, got %d", rr.Code)
	}

	// GET and verify persistence
	req2, _ := http.NewRequest("GET", "/api/v1/settings", nil)
	rr2 := httptest.NewRecorder()
	router.ServeHTTP(rr2, req2)

	var s types.Settings
	json.NewDecoder(rr2.Body).Decode(&s)

	if s.DefaultProvider != "ollama" {
		t.Errorf("expected 'ollama', got %q", s.DefaultProvider)
	}
	if s.DefaultModel != "llama3" {
		t.Errorf("expected 'llama3', got %q", s.DefaultModel)
	}
	if s.OllamaEndpoint != "http://custom:1234" {
		t.Errorf("expected custom endpoint, got %q", s.OllamaEndpoint)
	}
}
