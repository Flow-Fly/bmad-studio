package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"bmad-studio/backend/types"

	"github.com/go-chi/chi/v5"
)

// mockProjectService is a mock implementation of ProjectService for testing
type mockProjectService struct {
	registerFunc   func(repoPath string) (interface{}, error)
	unregisterFunc func(projectName string) error
	listFunc       func() (interface{}, error)
	getFunc        func(projectName string) (interface{}, error)
}

func (m *mockProjectService) Register(repoPath string) (interface{}, error) {
	if m.registerFunc != nil {
		return m.registerFunc(repoPath)
	}
	return nil, nil
}

func (m *mockProjectService) Unregister(projectName string) error {
	if m.unregisterFunc != nil {
		return m.unregisterFunc(projectName)
	}
	return nil
}

func (m *mockProjectService) List() (interface{}, error) {
	if m.listFunc != nil {
		return m.listFunc()
	}
	return []types.RegistryEntry{}, nil
}

func (m *mockProjectService) Get(projectName string) (interface{}, error) {
	if m.getFunc != nil {
		return m.getFunc(projectName)
	}
	return nil, nil
}

// Test RegisterProject handler
func TestRegisterProject(t *testing.T) {
	tests := []struct {
		name           string
		requestBody    interface{}
		mockRegister   func(repoPath string) (interface{}, error)
		expectedStatus int
		expectedCode   string
		checkResponse  func(t *testing.T, body map[string]interface{})
	}{
		{
			name: "happy path - successful registration",
			requestBody: map[string]string{
				"repoPath": "/path/to/project",
			},
			mockRegister: func(repoPath string) (interface{}, error) {
				return &types.RegistryEntry{
					Name:      "project",
					RepoPath:  repoPath,
					StorePath: "/store/projects/project",
				}, nil
			},
			expectedStatus: http.StatusCreated,
			checkResponse: func(t *testing.T, body map[string]interface{}) {
				if body["name"] != "project" {
					t.Errorf("expected name 'project', got %v", body["name"])
				}
				if body["repoPath"] != "/path/to/project" {
					t.Errorf("expected repoPath '/path/to/project', got %v", body["repoPath"])
				}
				if body["storePath"] != "/store/projects/project" {
					t.Errorf("expected storePath '/store/projects/project', got %v", body["storePath"])
				}
			},
		},
		{
			name: "duplicate repoPath - 409 conflict",
			requestBody: map[string]string{
				"repoPath": "/path/to/project",
			},
			mockRegister: func(repoPath string) (interface{}, error) {
				return nil, errors.New("project already registered: /path/to/project")
			},
			expectedStatus: http.StatusConflict,
			expectedCode:   "already_exists",
		},
		{
			name: "not a git repository - 400 bad request",
			requestBody: map[string]string{
				"repoPath": "/path/to/not-git",
			},
			mockRegister: func(repoPath string) (interface{}, error) {
				return nil, errors.New("path is not a git repository: /path/to/not-git")
			},
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_request",
		},
		{
			name: "not a directory - 400 bad request",
			requestBody: map[string]string{
				"repoPath": "/path/to/file.txt",
			},
			mockRegister: func(repoPath string) (interface{}, error) {
				return nil, errors.New("path is not a directory: /path/to/file.txt")
			},
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_request",
		},
		{
			name: "path does not exist - 400 bad request",
			requestBody: map[string]string{
				"repoPath": "/nonexistent/path",
			},
			mockRegister: func(repoPath string) (interface{}, error) {
				return nil, errors.New("validate path: stat /nonexistent/path: no such file or directory")
			},
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_request",
		},
		{
			name:           "missing request body - 400 bad request",
			requestBody:    "",
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_request",
		},
		{
			name: "missing repoPath field - 400 bad request",
			requestBody: map[string]string{
				"path": "/wrong/field",
			},
			expectedStatus: http.StatusBadRequest,
			expectedCode:   "invalid_request",
		},
		{
			name: "internal error - 500 internal server error",
			requestBody: map[string]string{
				"repoPath": "/path/to/project",
			},
			mockRegister: func(repoPath string) (interface{}, error) {
				return nil, errors.New("unexpected internal error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedCode:   "internal_error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock service
			mockSvc := &mockProjectService{
				registerFunc: tt.mockRegister,
			}

			handler := NewProjectsHandler(mockSvc)

			// Create request
			var body []byte
			if tt.requestBody != "" {
				body, _ = json.Marshal(tt.requestBody)
			}
			req := httptest.NewRequest(http.MethodPost, "/projects", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			// Execute handler
			handler.RegisterProject(rec, req)

			// Check status code
			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			// Decode response
			var response map[string]interface{}
			if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			// Check error code if expected
			if tt.expectedCode != "" {
				errorObj, ok := response["error"].(map[string]interface{})
				if !ok {
					t.Fatalf("expected error object in response, got %v", response)
				}
				if errorObj["code"] != tt.expectedCode {
					t.Errorf("expected error code '%s', got '%v'", tt.expectedCode, errorObj["code"])
				}
			}

			// Check response structure if provided
			if tt.checkResponse != nil {
				tt.checkResponse(t, response)
			}
		})
	}
}

// Test ListProjects handler
func TestListProjects(t *testing.T) {
	tests := []struct {
		name           string
		mockList       func() (interface{}, error)
		expectedStatus int
		expectedCount  int
	}{
		{
			name: "empty list",
			mockList: func() (interface{}, error) {
				return []types.RegistryEntry{}, nil
			},
			expectedStatus: http.StatusOK,
			expectedCount:  0,
		},
		{
			name: "populated list",
			mockList: func() (interface{}, error) {
				return []types.RegistryEntry{
					{Name: "project1", RepoPath: "/path/to/project1", StorePath: "/store/projects/project1"},
					{Name: "project2", RepoPath: "/path/to/project2", StorePath: "/store/projects/project2"},
				}, nil
			},
			expectedStatus: http.StatusOK,
			expectedCount:  2,
		},
		{
			name: "internal error",
			mockList: func() (interface{}, error) {
				return nil, errors.New("registry read error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedCount:  -1, // Not checking count for errors
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockProjectService{
				listFunc: tt.mockList,
			}

			handler := NewProjectsHandler(mockSvc)

			req := httptest.NewRequest(http.MethodGet, "/projects", nil)
			rec := httptest.NewRecorder()

			handler.ListProjects(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			var response interface{}
			if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if tt.expectedCount >= 0 {
				projects, ok := response.([]interface{})
				if !ok {
					t.Fatalf("expected array response, got %T", response)
				}
				if len(projects) != tt.expectedCount {
					t.Errorf("expected %d projects, got %d", tt.expectedCount, len(projects))
				}
			}
		})
	}
}

// Test GetProject handler
func TestGetProject(t *testing.T) {
	tests := []struct {
		name           string
		projectID      string
		mockGet        func(projectName string) (interface{}, error)
		expectedStatus int
		expectedCode   string
		checkResponse  func(t *testing.T, body map[string]interface{})
	}{
		{
			name:      "project exists",
			projectID: "my-project",
			mockGet: func(projectName string) (interface{}, error) {
				return &types.ProjectMeta{
					Name:      "my-project",
					RepoPath:  "/path/to/my-project",
					CreatedAt: "2026-02-12T10:00:00Z",
					Settings:  map[string]any{"theme": "dark"},
				}, nil
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body map[string]interface{}) {
				if body["name"] != "my-project" {
					t.Errorf("expected name 'my-project', got %v", body["name"])
				}
				if body["repoPath"] != "/path/to/my-project" {
					t.Errorf("expected repoPath, got %v", body["repoPath"])
				}
				if body["createdAt"] != "2026-02-12T10:00:00Z" {
					t.Errorf("expected createdAt, got %v", body["createdAt"])
				}
			},
		},
		{
			name:      "project not found",
			projectID: "nonexistent",
			mockGet: func(projectName string) (interface{}, error) {
				return nil, errors.New("project not found: nonexistent")
			},
			expectedStatus: http.StatusNotFound,
			expectedCode:   "not_found",
		},
		{
			name:      "internal error",
			projectID: "my-project",
			mockGet: func(projectName string) (interface{}, error) {
				return nil, errors.New("disk read error")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedCode:   "internal_error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockProjectService{
				getFunc: tt.mockGet,
			}

			handler := NewProjectsHandler(mockSvc)

			req := httptest.NewRequest(http.MethodGet, "/projects/"+tt.projectID, nil)
			rec := httptest.NewRecorder()

			// Inject chi URL param
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", tt.projectID)
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			handler.GetProject(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			var response map[string]interface{}
			if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if tt.expectedCode != "" {
				errorObj, ok := response["error"].(map[string]interface{})
				if !ok {
					t.Fatalf("expected error object in response, got %v", response)
				}
				if errorObj["code"] != tt.expectedCode {
					t.Errorf("expected error code '%s', got '%v'", tt.expectedCode, errorObj["code"])
				}
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, response)
			}
		})
	}
}

// Test UnregisterProject handler
func TestUnregisterProject(t *testing.T) {
	tests := []struct {
		name           string
		projectID      string
		mockUnregister func(projectName string) error
		expectedStatus int
		expectedCode   string
	}{
		{
			name:      "successful unregister",
			projectID: "my-project",
			mockUnregister: func(projectName string) error {
				return nil
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:      "project not found",
			projectID: "nonexistent",
			mockUnregister: func(projectName string) error {
				return errors.New("project not found: nonexistent")
			},
			expectedStatus: http.StatusNotFound,
			expectedCode:   "not_found",
		},
		{
			name:      "internal error",
			projectID: "my-project",
			mockUnregister: func(projectName string) error {
				return errors.New("registry update failed")
			},
			expectedStatus: http.StatusInternalServerError,
			expectedCode:   "internal_error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockProjectService{
				unregisterFunc: tt.mockUnregister,
			}

			handler := NewProjectsHandler(mockSvc)

			req := httptest.NewRequest(http.MethodDelete, "/projects/"+tt.projectID, nil)
			rec := httptest.NewRecorder()

			// Inject chi URL param
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("id", tt.projectID)
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			handler.UnregisterProject(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			var response map[string]interface{}
			if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if tt.expectedCode != "" {
				errorObj, ok := response["error"].(map[string]interface{})
				if !ok {
					t.Fatalf("expected error object in response, got %v", response)
				}
				if errorObj["code"] != tt.expectedCode {
					t.Errorf("expected error code '%s', got '%v'", tt.expectedCode, errorObj["code"])
				}
			}

			// Check success message
			if tt.expectedStatus == http.StatusOK {
				if _, hasMessage := response["message"]; !hasMessage {
					t.Error("expected message field in success response")
				}
			}
		})
	}
}

// Test error format compliance
func TestErrorFormat(t *testing.T) {
	mockSvc := &mockProjectService{
		registerFunc: func(repoPath string) (interface{}, error) {
			return nil, errors.New("test error")
		},
	}

	handler := NewProjectsHandler(mockSvc)

	body, _ := json.Marshal(map[string]string{"repoPath": "/path"})
	req := httptest.NewRequest(http.MethodPost, "/projects", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	handler.RegisterProject(rec, req)

	var response map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Verify error format: { "error": { "code": "...", "message": "..." } }
	errorObj, ok := response["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected error object in response, got %v", response)
	}

	if _, hasCode := errorObj["code"]; !hasCode {
		t.Error("expected 'code' field in error object")
	}

	if _, hasMessage := errorObj["message"]; !hasMessage {
		t.Error("expected 'message' field in error object")
	}

	// Ensure no extra fields at root level
	if len(response) != 1 {
		t.Errorf("expected only 'error' field at root level, got %d fields: %v", len(response), response)
	}
}
