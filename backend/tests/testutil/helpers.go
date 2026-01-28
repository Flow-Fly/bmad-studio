package testutil

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestServer wraps an http.Handler for testing
type TestServer struct {
	Handler http.Handler
}

// NewTestServer creates a new test server wrapper
func NewTestServer(handler http.Handler) *TestServer {
	return &TestServer{Handler: handler}
}

// Request performs a test request and returns the response recorder
func (ts *TestServer) Request(t *testing.T, method, path string) *httptest.ResponseRecorder {
	t.Helper()

	req, err := http.NewRequest(method, path, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	ts.Handler.ServeHTTP(rr, req)
	return rr
}

// RequestWithOrigin performs a test request with an Origin header
func (ts *TestServer) RequestWithOrigin(t *testing.T, method, path, origin string) *httptest.ResponseRecorder {
	t.Helper()

	req, err := http.NewRequest(method, path, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Origin", origin)

	rr := httptest.NewRecorder()
	ts.Handler.ServeHTTP(rr, req)
	return rr
}

// AssertStatus checks that the response has the expected status code
func AssertStatus(t *testing.T, rr *httptest.ResponseRecorder, expected int) {
	t.Helper()
	if rr.Code != expected {
		t.Errorf("Expected status %d, got %d", expected, rr.Code)
	}
}

// AssertContentType checks that the response has the expected content type
func AssertContentType(t *testing.T, rr *httptest.ResponseRecorder, expected string) {
	t.Helper()
	contentType := rr.Header().Get("Content-Type")
	if contentType != expected {
		t.Errorf("Expected Content-Type %s, got %s", expected, contentType)
	}
}

// AssertJSONResponse checks that the response is valid JSON and decodes it
func AssertJSONResponse(t *testing.T, rr *httptest.ResponseRecorder, target interface{}) {
	t.Helper()
	AssertContentType(t, rr, "application/json")

	if err := json.NewDecoder(rr.Body).Decode(target); err != nil {
		t.Fatalf("Failed to decode JSON response: %v", err)
	}
}

// AssertCORSOrigin checks that the CORS Allow-Origin header matches
func AssertCORSOrigin(t *testing.T, rr *httptest.ResponseRecorder, expected string) {
	t.Helper()
	actual := rr.Header().Get("Access-Control-Allow-Origin")
	if actual != expected {
		t.Errorf("Expected CORS origin %s, got %s", expected, actual)
	}
}
