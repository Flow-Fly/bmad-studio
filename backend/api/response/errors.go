package response

import (
	"encoding/json"
	"log"
	"net/http"
)

// ErrorResponse is the standard API error format
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail contains error code and message
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Standard error codes
const (
	ErrCodeInvalidRequest  = "invalid_request"
	ErrCodeNotFound        = "not_found"
	ErrCodeInternalError   = "internal_error"
	ErrCodeValidationError = "validation_error"
	ErrCodeNotImplemented  = "not_implemented"
	ErrCodeUnauthorized    = "unauthorized"
	ErrCodeAlreadyExists   = "already_exists"
)

// WriteError writes a standardized error response
func WriteError(w http.ResponseWriter, code string, message string, httpStatus int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)

	resp := ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
		},
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("Error encoding error response: %v", err)
	}
}

// WriteNotFound writes a 404 not found error
func WriteNotFound(w http.ResponseWriter, message string) {
	WriteError(w, ErrCodeNotFound, message, http.StatusNotFound)
}

// WriteInvalidRequest writes a 400 bad request error
func WriteInvalidRequest(w http.ResponseWriter, message string) {
	WriteError(w, ErrCodeInvalidRequest, message, http.StatusBadRequest)
}

// WriteValidationError writes a 422 validation error
func WriteValidationError(w http.ResponseWriter, message string) {
	WriteError(w, ErrCodeValidationError, message, http.StatusUnprocessableEntity)
}

// WriteInternalError writes a 500 internal server error
func WriteInternalError(w http.ResponseWriter, message string) {
	WriteError(w, ErrCodeInternalError, message, http.StatusInternalServerError)
}

// WriteNotImplemented writes a 501 not implemented error
func WriteNotImplemented(w http.ResponseWriter) {
	WriteError(w, ErrCodeNotImplemented, "This endpoint is not yet implemented", http.StatusNotImplemented)
}
