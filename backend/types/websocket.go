package types

import "time"

// WebSocket event type constants
const (
	EventTypeArtifactCreated       = "artifact:created"
	EventTypeArtifactUpdated       = "artifact:updated"
	EventTypeArtifactDeleted       = "artifact:deleted"
	EventTypeWorkflowStatusChanged = "workflow:status-changed"
	EventTypeConnectionStatus      = "connection:status"

	// Chat event types (client → server)
	EventTypeChatSend   = "chat:send"
	EventTypeChatCancel = "chat:cancel"

	// Chat event types (server → client)
	EventTypeChatStreamStart  = "chat:stream-start"
	EventTypeChatTextDelta    = "chat:text-delta"
	EventTypeChatThinkingDelta = "chat:thinking-delta"
	EventTypeChatStreamEnd    = "chat:stream-end"
	EventTypeChatError        = "chat:error"
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

// ChatStreamStartPayload is the payload for chat:stream-start events
type ChatStreamStartPayload struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
	Model          string `json:"model"`
}

// ChatTextDeltaPayload is the payload for chat:text-delta events
type ChatTextDeltaPayload struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
	Content        string `json:"content"`
	Index          int    `json:"index"`
}

// ChatThinkingDeltaPayload is the payload for chat:thinking-delta events
type ChatThinkingDeltaPayload struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
	Content        string `json:"content"`
	Index          int    `json:"index"`
}

// ChatStreamEndPayload is the payload for chat:stream-end events
type ChatStreamEndPayload struct {
	ConversationID string     `json:"conversation_id"`
	MessageID      string     `json:"message_id"`
	Usage          *UsageStats `json:"usage,omitempty"`
	Partial        bool       `json:"partial"`
}

// UsageStats contains token usage information for chat events
type UsageStats struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// ChatErrorPayload is the payload for chat:error events
type ChatErrorPayload struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
	Code           string `json:"code"`
	Message        string `json:"message"`
}

// ChatSendPayload is the payload for chat:send events (client → server)
type ChatSendPayload struct {
	ConversationID string `json:"conversation_id"`
	Content        string `json:"content"`
	Model          string `json:"model"`
	Provider       string `json:"provider"`
	SystemPrompt   string `json:"system_prompt,omitempty"`
	APIKey         string `json:"api_key"`
}

// ChatCancelPayload is the payload for chat:cancel events (client → server)
type ChatCancelPayload struct {
	ConversationID string `json:"conversation_id"`
}

// NewWebSocketEvent creates a new WebSocket event with current timestamp
func NewWebSocketEvent(eventType string, payload interface{}) *WebSocketEvent {
	return &WebSocketEvent{
		Type:      eventType,
		Payload:   payload,
		Timestamp: time.Now().UTC(),
	}
}

// newArtifactEventPayload builds the shared payload for artifact create/update events
func newArtifactEventPayload(artifact *ArtifactResponse) *ArtifactEventPayload {
	return &ArtifactEventPayload{
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
}

// NewArtifactCreatedEvent creates an artifact:created event from an ArtifactResponse
func NewArtifactCreatedEvent(artifact *ArtifactResponse) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeArtifactCreated, newArtifactEventPayload(artifact))
}

// NewArtifactUpdatedEvent creates an artifact:updated event from an ArtifactResponse
func NewArtifactUpdatedEvent(artifact *ArtifactResponse) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeArtifactUpdated, newArtifactEventPayload(artifact))
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

// NewChatStreamStartEvent creates a chat:stream-start event
func NewChatStreamStartEvent(conversationID, messageID, model string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatStreamStart, &ChatStreamStartPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		Model:          model,
	})
}

// NewChatTextDeltaEvent creates a chat:text-delta event
func NewChatTextDeltaEvent(conversationID, messageID, content string, index int) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatTextDelta, &ChatTextDeltaPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		Content:        content,
		Index:          index,
	})
}

// NewChatThinkingDeltaEvent creates a chat:thinking-delta event
func NewChatThinkingDeltaEvent(conversationID, messageID, content string, index int) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatThinkingDelta, &ChatThinkingDeltaPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		Content:        content,
		Index:          index,
	})
}

// NewChatStreamEndEvent creates a chat:stream-end event
func NewChatStreamEndEvent(conversationID, messageID string, usage *UsageStats, partial bool) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatStreamEnd, &ChatStreamEndPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		Usage:          usage,
		Partial:        partial,
	})
}

// NewChatErrorEvent creates a chat:error event
func NewChatErrorEvent(conversationID, messageID, code, message string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatError, &ChatErrorPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		Code:           code,
		Message:        message,
	})
}
