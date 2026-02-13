package handlers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"bmad-studio/backend/api/handlers"
	"bmad-studio/backend/services"
	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"
)

// MockBroadcaster implements services.Broadcaster for testing
type MockBroadcaster struct {
	Events []*types.WebSocketEvent
}

func (m *MockBroadcaster) BroadcastEvent(event *types.WebSocketEvent) {
	m.Events = append(m.Events, event)
}

// resolveDir resolves symlinks in the directory path (required for macOS temp dirs)
func resolveDir(t *testing.T, dir string) string {
	t.Helper()
	resolved, err := filepath.EvalSymlinks(dir)
	require.NoError(t, err, "failed to resolve directory symlinks")
	return resolved
}

// setupTestServer creates a test server with all handlers wired
func setupTestServer(t *testing.T) (*chi.Mux, *storage.RegistryStore, *services.StreamService, *MockBroadcaster) {
	t.Helper()

	// Setup test stores
	rootDir := resolveDir(t, t.TempDir())
	centralStore := storage.NewCentralStoreWithPath(rootDir)
	require.NoError(t, centralStore.Init())

	registryStore := storage.NewRegistryStore(centralStore)
	streamStore := storage.NewStreamStore(centralStore)
	mockHub := &MockBroadcaster{}

	streamService := services.NewStreamService(streamStore, registryStore, mockHub)

	// Create handler and router
	handler := handlers.NewStreamsHandler(streamService)
	router := chi.NewRouter()
	router.Route("/projects/{id}/streams", func(r chi.Router) {
		r.Post("/", handler.CreateStream)
		r.Get("/", handler.ListStreams)
		r.Route("/{sid}", func(r chi.Router) {
			r.Get("/", handler.GetStream)
			r.Put("/", handler.UpdateStream)
			r.Post("/archive", handler.ArchiveStream)
		})
	})

	return router, registryStore, streamService, mockHub
}

func TestStreamsHandler_CreateStream(t *testing.T) {
	router, registryStore, _, mockHub := setupTestServer(t)

	// Register test project
	err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
	require.NoError(t, err)

	tests := []struct {
		name           string
		projectName    string
		body           string
		expectedStatus int
		expectedError  string
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:           "success - create stream",
			projectName:    "test-app",
			body:           `{"name":"feature-x"}`,
			expectedStatus: http.StatusCreated,
			checkResponse: func(t *testing.T, body []byte) {
				var resp types.StreamMeta
				err := json.Unmarshal(body, &resp)
				require.NoError(t, err)
				require.Equal(t, "feature-x", resp.Name)
				require.Equal(t, "test-app", resp.Project)
				require.Equal(t, types.StreamStatusActive, resp.Status)
				require.NotEmpty(t, resp.CreatedAt)
				require.NotEmpty(t, resp.UpdatedAt)

				// Verify broadcast
				require.Len(t, mockHub.Events, 1)
				require.Equal(t, types.EventTypeStreamCreated, mockHub.Events[0].Type)
			},
		},
		{
			name:           "duplicate stream name",
			projectName:    "test-app",
			body:           `{"name":"feature-x"}`,
			expectedStatus: http.StatusConflict,
			expectedError:  "already exists",
		},
		{
			name:           "invalid JSON",
			projectName:    "test-app",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid JSON",
		},
		{
			name:           "missing name field",
			projectName:    "test-app",
			body:           `{}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Missing required field: name",
		},
		{
			name:           "project not found",
			projectName:    "nonexistent",
			body:           `{"name":"feature-y"}`,
			expectedStatus: http.StatusNotFound,
			expectedError:  "not found",
		},
		{
			name:           "invalid stream name",
			projectName:    "test-app",
			body:           `{"name":"invalid name with spaces"}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid stream name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockHub.Events = nil // Reset events

			req := httptest.NewRequest("POST", fmt.Sprintf("/projects/%s/streams", tt.projectName), bytes.NewReader([]byte(tt.body)))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			require.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var errResp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &errResp)
				require.NoError(t, err)
				require.Contains(t, errResp, "error")
				errorMap := errResp["error"].(map[string]interface{})
				require.Contains(t, errorMap["message"], tt.expectedError)
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
		})
	}
}

func TestStreamsHandler_ListStreams(t *testing.T) {
	tests := []struct {
		name           string
		projectName    string
		setupStreams   []string
		expectedStatus int
		expectedCount  int
		expectedError  string
	}{
		{
			name:           "empty list",
			projectName:    "test-app",
			setupStreams:   nil,
			expectedStatus: http.StatusOK,
			expectedCount:  0,
		},
		{
			name:           "single stream",
			projectName:    "test-app",
			setupStreams:   []string{"feature-a"},
			expectedStatus: http.StatusOK,
			expectedCount:  1,
		},
		{
			name:           "multiple streams",
			projectName:    "test-app",
			setupStreams:   []string{"feature-a", "feature-b", "feature-c"},
			expectedStatus: http.StatusOK,
			expectedCount:  3,
		},
		{
			name:           "project not found",
			projectName:    "nonexistent",
			setupStreams:   nil,
			expectedStatus: http.StatusNotFound,
			expectedError:  "not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh test server for each subtest
			router, registryStore, streamService, _ := setupTestServer(t)

			// Register test project
			err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
			require.NoError(t, err)

			// Setup streams
			for _, name := range tt.setupStreams {
				_, err := streamService.Create(tt.projectName, name)
				if tt.projectName == "test-app" {
					require.NoError(t, err)
				}
			}

			req := httptest.NewRequest("GET", fmt.Sprintf("/projects/%s/streams", tt.projectName), nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			require.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var errResp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &errResp)
				require.NoError(t, err)
				require.Contains(t, errResp, "error")
			} else {
				var streams []*types.StreamMeta
				err := json.Unmarshal(w.Body.Bytes(), &streams)
				require.NoError(t, err)
				require.Len(t, streams, tt.expectedCount)

				// Verify streams are sorted by updatedAt descending
				if len(streams) > 1 {
					for i := 0; i < len(streams)-1; i++ {
						require.True(t, streams[i].UpdatedAt >= streams[i+1].UpdatedAt)
					}
				}
			}
		})
	}
}

func TestStreamsHandler_GetStream(t *testing.T) {
	router, registryStore, streamService, _ := setupTestServer(t)

	// Register test project
	err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
	require.NoError(t, err)

	// Create test stream
	meta, err := streamService.Create("test-app", "feature-x")
	require.NoError(t, err)

	tests := []struct {
		name           string
		projectName    string
		streamID       string
		expectedStatus int
		expectedError  string
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:           "success - get stream",
			projectName:    "test-app",
			streamID:       "test-app-feature-x",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var resp types.StreamMeta
				err := json.Unmarshal(body, &resp)
				require.NoError(t, err)
				require.Equal(t, meta.Name, resp.Name)
				require.Equal(t, meta.Project, resp.Project)
				require.Equal(t, meta.Status, resp.Status)
			},
		},
		{
			name:           "invalid streamID format",
			projectName:    "test-app",
			streamID:       "invalid-format",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Stream ID must start with",
		},
		{
			name:           "stream not found",
			projectName:    "test-app",
			streamID:       "test-app-nonexistent",
			expectedStatus: http.StatusNotFound,
			expectedError:  "not found",
		},
		{
			name:           "project not found",
			projectName:    "nonexistent",
			streamID:       "nonexistent-feature",
			expectedStatus: http.StatusNotFound,
			expectedError:  "not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", fmt.Sprintf("/projects/%s/streams/%s", tt.projectName, tt.streamID), nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			require.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var errResp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &errResp)
				require.NoError(t, err)
				require.Contains(t, errResp, "error")
				errorMap := errResp["error"].(map[string]interface{})
				require.Contains(t, errorMap["message"], tt.expectedError)
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
		})
	}
}

func TestStreamsHandler_UpdateStream(t *testing.T) {
	router, registryStore, streamService, mockHub := setupTestServer(t)

	// Register test project
	err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
	require.NoError(t, err)

	// Create test stream
	originalMeta, err := streamService.Create("test-app", "feature-x")
	require.NoError(t, err)
	mockHub.Events = nil // Reset after create

	tests := []struct {
		name           string
		projectName    string
		streamID       string
		body           string
		expectedStatus int
		expectedError  string
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:           "success - update metadata",
			projectName:    "test-app",
			streamID:       "test-app-feature-x",
			body:           `{"branch":"feature/x","worktree":"/path/to/worktree"}`,
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var resp types.StreamMeta
				err := json.Unmarshal(body, &resp)
				require.NoError(t, err)
				require.Equal(t, "feature-x", resp.Name)
				require.Equal(t, "feature/x", resp.Branch)
				require.Equal(t, "/path/to/worktree", resp.Worktree)
				require.GreaterOrEqual(t, resp.UpdatedAt, originalMeta.UpdatedAt)

				// Verify broadcast
				require.Len(t, mockHub.Events, 1)
				require.Equal(t, types.EventTypeStreamUpdated, mockHub.Events[0].Type)
			},
		},
		{
			name:           "invalid JSON",
			projectName:    "test-app",
			streamID:       "test-app-feature-x",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid JSON",
		},
		{
			name:           "invalid streamID format",
			projectName:    "test-app",
			streamID:       "invalid-format",
			body:           `{"branch":"test"}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Stream ID must start with",
		},
		{
			name:           "stream not found",
			projectName:    "test-app",
			streamID:       "test-app-nonexistent",
			body:           `{"branch":"test"}`,
			expectedStatus: http.StatusNotFound,
			expectedError:  "not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockHub.Events = nil // Reset events

			req := httptest.NewRequest("PUT", fmt.Sprintf("/projects/%s/streams/%s", tt.projectName, tt.streamID), bytes.NewReader([]byte(tt.body)))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			require.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var errResp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &errResp)
				require.NoError(t, err)
				require.Contains(t, errResp, "error")
				errorMap := errResp["error"].(map[string]interface{})
				require.Contains(t, errorMap["message"], tt.expectedError)
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
		})
	}
}

func TestStreamsHandler_ArchiveStream(t *testing.T) {
	router, registryStore, streamService, mockHub := setupTestServer(t)

	// Register test project
	err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
	require.NoError(t, err)

	tests := []struct {
		name           string
		setupStream    bool
		projectName    string
		streamID       string
		body           string
		expectedStatus int
		expectedError  string
		checkResponse  func(t *testing.T, body []byte)
	}{
		{
			name:           "success - archive merged",
			setupStream:    true,
			projectName:    "test-app",
			streamID:       "test-app-feature-merged",
			body:           `{"outcome":"merged"}`,
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var resp types.StreamMeta
				err := json.Unmarshal(body, &resp)
				require.NoError(t, err)
				require.Equal(t, types.StreamStatusArchived, resp.Status)
				require.Equal(t, types.StreamOutcomeMerged, resp.Outcome)

				// Verify broadcast
				require.Len(t, mockHub.Events, 2) // 1 create + 1 archive
				require.Equal(t, types.EventTypeStreamArchived, mockHub.Events[1].Type)
			},
		},
		{
			name:           "success - archive abandoned",
			setupStream:    true,
			projectName:    "test-app",
			streamID:       "test-app-feature-abandoned",
			body:           `{"outcome":"abandoned"}`,
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, body []byte) {
				var resp types.StreamMeta
				err := json.Unmarshal(body, &resp)
				require.NoError(t, err)
				require.Equal(t, types.StreamStatusArchived, resp.Status)
				require.Equal(t, types.StreamOutcomeAbandoned, resp.Outcome)
			},
		},
		{
			name:           "invalid outcome",
			setupStream:    true,
			projectName:    "test-app",
			streamID:       "test-app-feature-invalid",
			body:           `{"outcome":"invalid"}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "must be 'merged' or 'abandoned'",
		},
		{
			name:           "invalid JSON",
			setupStream:    true,
			projectName:    "test-app",
			streamID:       "test-app-feature-json",
			body:           `{invalid}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid JSON",
		},
		{
			name:           "invalid streamID format",
			setupStream:    false,
			projectName:    "test-app",
			streamID:       "invalid-format",
			body:           `{"outcome":"merged"}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Stream ID must start with",
		},
		{
			name:           "stream not found",
			setupStream:    false,
			projectName:    "test-app",
			streamID:       "test-app-nonexistent",
			body:           `{"outcome":"merged"}`,
			expectedStatus: http.StatusNotFound,
			expectedError:  "not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockHub.Events = nil // Reset events

			// Setup stream if needed
			if tt.setupStream {
				streamName := tt.streamID[len("test-app-"):]
				_, err := streamService.Create("test-app", streamName)
				require.NoError(t, err)
			}

			req := httptest.NewRequest("POST", fmt.Sprintf("/projects/%s/streams/%s/archive", tt.projectName, tt.streamID), bytes.NewReader([]byte(tt.body)))
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			require.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var errResp map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &errResp)
				require.NoError(t, err)
				require.Contains(t, errResp, "error")
				errorMap := errResp["error"].(map[string]interface{})
				require.Contains(t, errorMap["message"], tt.expectedError)
			}

			if tt.checkResponse != nil {
				tt.checkResponse(t, w.Body.Bytes())
			}
		})
	}
}

func TestStreamsHandler_ListStreams_ExcludesArchived(t *testing.T) {
	router, registryStore, streamService, _ := setupTestServer(t)

	// Register test project
	err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
	require.NoError(t, err)

	// Create active streams
	_, err = streamService.Create("test-app", "active-1")
	require.NoError(t, err)
	_, err = streamService.Create("test-app", "active-2")
	require.NoError(t, err)

	// Create and archive a stream
	_, err = streamService.Create("test-app", "archived-stream")
	require.NoError(t, err)
	_, err = streamService.Archive("test-app", "archived-stream", "merged", false)
	require.NoError(t, err)

	// List streams
	req := httptest.NewRequest("GET", "/projects/test-app/streams", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var streams []*types.StreamMeta
	err = json.Unmarshal(w.Body.Bytes(), &streams)
	require.NoError(t, err)

	// Should only return active streams
	require.Len(t, streams, 2)
	for _, stream := range streams {
		require.Equal(t, types.StreamStatusActive, stream.Status)
	}
}

func TestStreamsHandler_AlreadyArchived(t *testing.T) {
	router, registryStore, streamService, _ := setupTestServer(t)

	// Register test project
	err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
	require.NoError(t, err)

	// Create and archive stream
	_, err = streamService.Create("test-app", "feature-x")
	require.NoError(t, err)
	_, err = streamService.Archive("test-app", "feature-x", "merged", false)
	require.NoError(t, err)

	// Try to archive again - archived streams are in different directory, so returns 404
	body := `{"outcome":"abandoned"}`
	req := httptest.NewRequest("POST", "/projects/test-app/streams/test-app-feature-x/archive", bytes.NewReader([]byte(body)))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusNotFound, w.Code)

	var errResp map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &errResp)
	require.NoError(t, err)
	require.Contains(t, errResp, "error")
	errorMap := errResp["error"].(map[string]interface{})
	require.Contains(t, errorMap["message"], "not found")
}

func TestStreamsHandler_JSONFieldsCamelCase(t *testing.T) {
	router, registryStore, streamService, _ := setupTestServer(t)

	// Register test project
	err := registryStore.AddProject(types.RegistryEntry{Name: "test-app", RepoPath: "/tmp/test"})
	require.NoError(t, err)

	// Create stream
	_, err = streamService.Create("test-app", "feature-x")
	require.NoError(t, err)

	// Get stream
	req := httptest.NewRequest("GET", "/projects/test-app/streams/test-app-feature-x", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	// Parse as generic map to verify field names
	var respMap map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &respMap)
	require.NoError(t, err)

	// Verify camelCase fields
	require.Contains(t, respMap, "name")
	require.Contains(t, respMap, "project")
	require.Contains(t, respMap, "status")
	require.Contains(t, respMap, "type")
	require.Contains(t, respMap, "createdAt")
	require.Contains(t, respMap, "updatedAt")

	// Verify no snake_case fields
	require.NotContains(t, respMap, "created_at")
	require.NotContains(t, respMap, "updated_at")
}
