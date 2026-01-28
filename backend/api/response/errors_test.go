package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteError(t *testing.T) {
	rr := httptest.NewRecorder()

	WriteError(rr, "test_error", "Test message", http.StatusBadRequest)

	// Check status code
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, status)
	}

	// Check content type
	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}

	// Check response structure
	var errResp ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&errResp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if errResp.Error.Code != "test_error" {
		t.Errorf("Expected error code 'test_error', got '%s'", errResp.Error.Code)
	}
	if errResp.Error.Message != "Test message" {
		t.Errorf("Expected error message 'Test message', got '%s'", errResp.Error.Message)
	}
}

func TestWriteNotFound(t *testing.T) {
	rr := httptest.NewRecorder()

	WriteNotFound(rr, "Resource not found")

	if rr.Code != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, rr.Code)
	}

	var errResp ErrorResponse
	json.NewDecoder(rr.Body).Decode(&errResp)

	if errResp.Error.Code != ErrCodeNotFound {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeNotFound, errResp.Error.Code)
	}
}

func TestWriteInvalidRequest(t *testing.T) {
	rr := httptest.NewRecorder()

	WriteInvalidRequest(rr, "Invalid input")

	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	var errResp ErrorResponse
	json.NewDecoder(rr.Body).Decode(&errResp)

	if errResp.Error.Code != ErrCodeInvalidRequest {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeInvalidRequest, errResp.Error.Code)
	}
}

func TestWriteValidationError(t *testing.T) {
	rr := httptest.NewRecorder()

	WriteValidationError(rr, "Validation failed")

	if rr.Code != http.StatusUnprocessableEntity {
		t.Errorf("Expected status %d, got %d", http.StatusUnprocessableEntity, rr.Code)
	}

	var errResp ErrorResponse
	json.NewDecoder(rr.Body).Decode(&errResp)

	if errResp.Error.Code != ErrCodeValidationError {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeValidationError, errResp.Error.Code)
	}
}

func TestWriteInternalError(t *testing.T) {
	rr := httptest.NewRecorder()

	WriteInternalError(rr, "Internal error")

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, rr.Code)
	}

	var errResp ErrorResponse
	json.NewDecoder(rr.Body).Decode(&errResp)

	if errResp.Error.Code != ErrCodeInternalError {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeInternalError, errResp.Error.Code)
	}
}

func TestWriteNotImplemented(t *testing.T) {
	rr := httptest.NewRecorder()

	WriteNotImplemented(rr)

	if rr.Code != http.StatusNotImplemented {
		t.Errorf("Expected status %d, got %d", http.StatusNotImplemented, rr.Code)
	}

	var errResp ErrorResponse
	json.NewDecoder(rr.Body).Decode(&errResp)

	if errResp.Error.Code != ErrCodeNotImplemented {
		t.Errorf("Expected error code '%s', got '%s'", ErrCodeNotImplemented, errResp.Error.Code)
	}
}

func TestErrorCodes(t *testing.T) {
	// Verify error codes match expected values
	tests := []struct {
		name     string
		constant string
		expected string
	}{
		{"invalid_request", ErrCodeInvalidRequest, "invalid_request"},
		{"not_found", ErrCodeNotFound, "not_found"},
		{"internal_error", ErrCodeInternalError, "internal_error"},
		{"validation_error", ErrCodeValidationError, "validation_error"},
		{"not_implemented", ErrCodeNotImplemented, "not_implemented"},
		{"unauthorized", ErrCodeUnauthorized, "unauthorized"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.constant != tc.expected {
				t.Errorf("Expected %s, got %s", tc.expected, tc.constant)
			}
		})
	}
}
