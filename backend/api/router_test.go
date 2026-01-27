package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
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
	var response HealthResponse
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
