package types

import "time"

// WebSocket event type constants
const (
	EventTypeArtifactCreated       = "artifact:created"
	EventTypeArtifactUpdated       = "artifact:updated"
	EventTypeArtifactDeleted       = "artifact:deleted"
	EventTypeWorkflowStatusChanged = "workflow:status-changed"
	EventTypeConnectionStatus      = "connection:status"
)

// WebSocketEvent represents a WebSocket message sent to clients
type WebSocketEvent struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
}

// ArtifactEventPayload is the payload for artifact events (created, updated)
type ArtifactEventPayload struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	Path      string  `json:"path"`
	Status    string  `json:"status"`
	Phase     int     `json:"phase"`
	PhaseName string  `json:"phase_name"`
	IsSharded bool    `json:"is_sharded"`
	ParentID  *string `json:"parent_id,omitempty"`
}

// ArtifactDeletedPayload is the payload for artifact:deleted events
type ArtifactDeletedPayload struct {
	ID   string `json:"id"`
	Path string `json:"path"`
}

// WorkflowStatusEventPayload is the payload for workflow:status-changed events
type WorkflowStatusEventPayload struct {
	WorkflowStatuses map[string]WorkflowCompletionStatus `json:"workflow_statuses"`
}

// ConnectionStatusPayload is the payload for connection:status events
type ConnectionStatusPayload struct {
	Status string `json:"status"` // "connected", "disconnected"
}

// NewWebSocketEvent creates a new WebSocket event with current timestamp
func NewWebSocketEvent(eventType string, payload interface{}) *WebSocketEvent {
	return &WebSocketEvent{
		Type:      eventType,
		Payload:   payload,
		Timestamp: time.Now().UTC(),
	}
}

// NewArtifactCreatedEvent creates an artifact:created event from an ArtifactResponse
func NewArtifactCreatedEvent(artifact *ArtifactResponse) *WebSocketEvent {
	payload := &ArtifactEventPayload{
		ID:        artifact.ID,
		Name:      artifact.Name,
		Type:      artifact.Type,
		Path:      artifact.Path,
		Status:    artifact.Status,
		Phase:     artifact.Phase,
		PhaseName: artifact.PhaseName,
		IsSharded: artifact.IsSharded,
		ParentID:  artifact.ParentID,
	}
	return NewWebSocketEvent(EventTypeArtifactCreated, payload)
}

// NewArtifactUpdatedEvent creates an artifact:updated event from an ArtifactResponse
func NewArtifactUpdatedEvent(artifact *ArtifactResponse) *WebSocketEvent {
	payload := &ArtifactEventPayload{
		ID:        artifact.ID,
		Name:      artifact.Name,
		Type:      artifact.Type,
		Path:      artifact.Path,
		Status:    artifact.Status,
		Phase:     artifact.Phase,
		PhaseName: artifact.PhaseName,
		IsSharded: artifact.IsSharded,
		ParentID:  artifact.ParentID,
	}
	return NewWebSocketEvent(EventTypeArtifactUpdated, payload)
}

// NewArtifactDeletedEvent creates an artifact:deleted event
func NewArtifactDeletedEvent(id, path string) *WebSocketEvent {
	payload := &ArtifactDeletedPayload{
		ID:   id,
		Path: path,
	}
	return NewWebSocketEvent(EventTypeArtifactDeleted, payload)
}

// NewWorkflowStatusChangedEvent creates a workflow:status-changed event
func NewWorkflowStatusChangedEvent(statuses map[string]WorkflowCompletionStatus) *WebSocketEvent {
	payload := &WorkflowStatusEventPayload{
		WorkflowStatuses: statuses,
	}
	return NewWebSocketEvent(EventTypeWorkflowStatusChanged, payload)
}
