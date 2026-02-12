package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"bmad-studio/backend/services"
	"bmad-studio/backend/storage"
)

func TestHealthEndpoint(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check content type
	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("handler returned wrong content type: got %v want %v", contentType, "application/json")
	}

	// Check response body
	var response struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response.Status != "ok" {
		t.Errorf("handler returned wrong status: got %v want %v", response.Status, "ok")
	}
}

func TestCORSHeaders(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("OPTIONS", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3007")
	req.Header.Set("Access-Control-Request-Method", "GET")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check that CORS headers are present
	allowOrigin := rr.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin != "http://localhost:3007" {
		t.Errorf("CORS header missing or incorrect: got %v want %v", allowOrigin, "http://localhost:3007")
	}
}

func TestCORSAllowedMethods(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("OPTIONS", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3007")
	req.Header.Set("Access-Control-Request-Method", "POST")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check that allowed methods include POST
	allowMethods := rr.Header().Get("Access-Control-Allow-Methods")
	if allowMethods == "" {
		t.Error("Access-Control-Allow-Methods header is missing")
	}
}

func TestCORSTauriOrigin(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("OPTIONS", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "tauri://localhost")
	req.Header.Set("Access-Control-Request-Method", "GET")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check that Tauri origin is allowed
	allowOrigin := rr.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin != "tauri://localhost" {
		t.Errorf("Tauri origin should be allowed: got %v want %v", allowOrigin, "tauri://localhost")
	}
}

func TestHealthEndpointWithCORS(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3007")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check status code
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Check CORS header on actual request (not just preflight)
	allowOrigin := rr.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin != "http://localhost:3007" {
		t.Errorf("CORS header on GET request: got %v want %v", allowOrigin, "http://localhost:3007")
	}
}

func TestNotFoundRoute(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("GET", "/nonexistent", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check 404 status code
	if status := rr.Code; status != http.StatusNotFound {
		t.Errorf("handler returned wrong status code for unknown route: got %v want %v", status, http.StatusNotFound)
	}
}

// Task 1 Tests: Router Infrastructure

func TestAPIVersionPrefix(t *testing.T) {
	router := NewRouter()

	// Test that /api/v1/projects route exists (returns 501 Not Implemented for placeholder)
	req, err := http.NewRequest("GET", "/api/v1/projects", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Should return 501 Not Implemented (placeholder), not 404 (route doesn't exist)
	if status := rr.Code; status == http.StatusNotFound {
		t.Errorf("API route /api/v1/projects should exist: got %v", status)
	}
}

func TestPlaceholderEndpointsExist(t *testing.T) {
	router := NewRouter()

	endpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/projects"},
		{"POST", "/api/v1/projects"},
		{"GET", "/api/v1/projects/123"},
		{"PUT", "/api/v1/projects/123"},
		{"GET", "/api/v1/sessions"},
		{"GET", "/api/v1/sessions/123"},
		{"GET", "/api/v1/providers"},
		{"POST", "/api/v1/providers"},
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint.method+" "+endpoint.path, func(t *testing.T) {
			req, err := http.NewRequest(endpoint.method, endpoint.path, nil)
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			// Should not be 404 - route must exist
			if status := rr.Code; status == http.StatusNotFound {
				t.Errorf("Route %s %s should exist, got 404", endpoint.method, endpoint.path)
			}

			// Should be 501 Not Implemented for placeholders
			if status := rr.Code; status != http.StatusNotImplemented {
				t.Errorf("Placeholder route %s %s should return 501 Not Implemented: got %v", endpoint.method, endpoint.path, status)
			}
		})
	}
}

func TestHealthEndpointStillWorks(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Health should still be at root, not under /api/v1
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Health endpoint should remain at /health: got %v want %v", status, http.StatusOK)
	}

	var response struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response.Status != "ok" {
		t.Errorf("Health endpoint should return ok: got %v", response.Status)
	}
}

// Task 2 Tests: Error Response Format

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func TestErrorResponseFormat(t *testing.T) {
	router := NewRouter()

	// Request a placeholder endpoint to get a 501 Not Implemented error
	req, err := http.NewRequest("GET", "/api/v1/projects", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check content type
	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Error response should have application/json content type: got %v", contentType)
	}

	// Check error response structure
	var errorResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errorResp); err != nil {
		t.Fatalf("Failed to decode error response: %v", err)
	}

	// Verify error object structure
	if errorResp.Error.Code == "" {
		t.Error("Error response should have error.code field")
	}
	if errorResp.Error.Message == "" {
		t.Error("Error response should have error.message field")
	}

	// Check specific values for not implemented
	if errorResp.Error.Code != "not_implemented" {
		t.Errorf("Expected error code 'not_implemented': got %v", errorResp.Error.Code)
	}
}

func TestErrorResponseCodes(t *testing.T) {
	// Test that error response format matches {"error": {"code": "...", "message": "..."}}
	tests := []struct {
		method       string
		path         string
		expectedCode string
	}{
		{"GET", "/api/v1/projects", "not_implemented"},
		{"GET", "/api/v1/sessions", "not_implemented"},
		{"GET", "/api/v1/providers", "not_implemented"},
	}

	router := NewRouter()

	for _, tc := range tests {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req, err := http.NewRequest(tc.method, tc.path, nil)
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			var errorResp ErrorResponse
			if err := json.NewDecoder(rr.Body).Decode(&errorResp); err != nil {
				t.Fatalf("Failed to decode error response: %v", err)
			}

			if errorResp.Error.Code != tc.expectedCode {
				t.Errorf("Expected error code %v: got %v", tc.expectedCode, errorResp.Error.Code)
			}
		})
	}
}

// Task 3 Tests: CORS Configuration

func TestCORSAllowsContentTypeHeader(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("OPTIONS", "/api/v1/projects", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3007")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Content-Type")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check that Content-Type is in allowed headers
	allowHeaders := rr.Header().Get("Access-Control-Allow-Headers")
	if allowHeaders == "" {
		t.Error("Access-Control-Allow-Headers should be set")
	}
}

func TestCORSAllowsAuthorizationHeader(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("OPTIONS", "/api/v1/providers", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3007")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Authorization")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check that Authorization is in allowed headers
	allowHeaders := rr.Header().Get("Access-Control-Allow-Headers")
	if allowHeaders == "" {
		t.Error("Access-Control-Allow-Headers should be set for Authorization")
	}
}

func TestCORSAllowsCredentials(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3007")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Check that credentials are allowed
	allowCreds := rr.Header().Get("Access-Control-Allow-Credentials")
	if allowCreds != "true" {
		t.Errorf("Access-Control-Allow-Credentials should be true: got %v", allowCreds)
	}
}

func TestCORSAllowsAllRequiredMethods(t *testing.T) {
	router := NewRouter()
	requiredMethods := []string{"GET", "POST", "PUT", "DELETE"}

	for _, method := range requiredMethods {
		t.Run(method, func(t *testing.T) {
			req, err := http.NewRequest("OPTIONS", "/api/v1/projects", nil)
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("Origin", "http://localhost:3007")
			req.Header.Set("Access-Control-Request-Method", method)

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			// Check preflight succeeds (200 status)
			if status := rr.Code; status != http.StatusOK {
				t.Errorf("Preflight for %s should succeed: got %v", method, status)
			}
		})
	}
}

// Story 1.3 Tests: Project Routes Resolution

func TestProjectRoutesExist(t *testing.T) {
	// Create minimal service instances for route registration
	// Using real services with temp directories
	tmpDir := t.TempDir()
	centralStore := storage.NewCentralStoreWithPath(tmpDir)
	registryStore := storage.NewRegistryStore(centralStore)
	projectStore := storage.NewProjectStore(centralStore)
	projectService := services.NewProjectService(registryStore, projectStore)

	router := NewRouterWithServices(RouterServices{
		Project: projectService,
	})

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/projects"},
		{"POST", "/api/v1/projects"},
		{"GET", "/api/v1/projects/test-project"},
		{"DELETE", "/api/v1/projects/test-project"},
	}

	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			req, err := http.NewRequest(route.method, route.path, nil)
			if err != nil {
				t.Fatal(err)
			}

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			// Route should exist - verified by NOT getting "404 page not found"
			// A 404 with JSON error response means the handler ran but didn't find the resource
			// A 404 with "404 page not found" text means chi couldn't route the request
			// Any 2xx, 4xx (except raw 404), or 5xx means the route was wired correctly
			if status := rr.Code; status == http.StatusNotFound {
				// Check if it's a JSON 404 from handler or chi's raw 404
				if rr.Body.String() == "404 page not found\n" {
					t.Errorf("Route %s %s should be wired in router (chi returned raw 404)", route.method, route.path)
				}
				// JSON 404 from handler is acceptable - route exists, resource doesn't
			}
		})
	}
}

func TestCORSMiddlewareActive(t *testing.T) {
	router := NewRouter()

	req, err := http.NewRequest("OPTIONS", "/api/v1/projects", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://localhost:3007")
	req.Header.Set("Access-Control-Request-Method", "POST")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	// Verify CORS middleware is active by checking for Access-Control-Allow-Origin header
	allowOrigin := rr.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin == "" {
		t.Error("CORS middleware should set Access-Control-Allow-Origin header")
	}

	if allowOrigin != "http://localhost:3007" {
		t.Errorf("CORS should allow localhost:3007 origin, got %v", allowOrigin)
	}
}

