package types

import "time"

// WebSocket event type constants
const (
	EventTypeArtifactCreated       = "artifact:created"
	EventTypeArtifactUpdated       = "artifact:updated"
	EventTypeArtifactDeleted       = "artifact:deleted"
	EventTypeWorkflowStatusChanged = "workflow:status-changed"
	EventTypeConnectionStatus      = "connection:status"

	// Stream event types (server → client)
	EventTypeStreamCreated      = "stream:created"
	EventTypeStreamArchived     = "stream:archived"
	EventTypeStreamUpdated      = "stream:updated"
	EventTypeStreamPhaseChanged = "stream:phase-changed"

	// Chat event types (client → server)
	EventTypeChatSend   = "chat:send"
	EventTypeChatCancel = "chat:cancel"

	// Chat event types (server → client)
	EventTypeChatStreamStart   = "chat:stream-start"
	EventTypeChatTextDelta     = "chat:text-delta"
	EventTypeChatThinkingDelta = "chat:thinking-delta"
	EventTypeChatStreamEnd     = "chat:stream-end"
	EventTypeChatError         = "chat:error"

	// Tool event types (server → client)
	EventTypeChatToolStart   = "chat:tool-start"
	EventTypeChatToolDelta   = "chat:tool-delta"
	EventTypeChatToolResult  = "chat:tool-result"
	EventTypeChatToolConfirm = "chat:tool-confirm"

	// Tool event types (client → server)
	EventTypeChatToolApprove = "chat:tool-approve"
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
	PhaseName string  `json:"phaseName"`
	IsSharded bool    `json:"isSharded"`
	ParentID  *string `json:"parentId,omitempty"`
}

// ArtifactDeletedPayload is the payload for artifact:deleted events
type ArtifactDeletedPayload struct {
	ID   string `json:"id"`
	Path string `json:"path"`
}

// ArtifactStreamEventPayload is the payload for stream-context artifact events
// Used by the central-store watcher (Story 3.1) to broadcast artifact changes within streams
type ArtifactStreamEventPayload struct {
	ProjectID string `json:"projectId"`
	StreamID  string `json:"streamId"`
	Filename  string `json:"filename"`
	Phase     string `json:"phase,omitempty"`
}

// WorkflowStatusEventPayload is the payload for workflow:status-changed events
type WorkflowStatusEventPayload struct {
	WorkflowStatuses map[string]WorkflowCompletionStatus `json:"workflow_statuses"`
}

// ConnectionStatusPayload is the payload for connection:status events
type ConnectionStatusPayload struct {
	Status string `json:"status"` // "connected", "disconnected"
}

// StreamCreatedPayload is the payload for stream:created events
type StreamCreatedPayload struct {
	ProjectID string `json:"projectId"`
	StreamID  string `json:"streamId"`
	Name      string `json:"name"`
}

// StreamArchivedPayload is the payload for stream:archived events
type StreamArchivedPayload struct {
	ProjectID string `json:"projectId"`
	StreamID  string `json:"streamId"`
	Outcome   string `json:"outcome"`
}

// StreamUpdatedPayload is the payload for stream:updated events
type StreamUpdatedPayload struct {
	ProjectID string                 `json:"projectId"`
	StreamID  string                 `json:"streamId"`
	Changes   map[string]interface{} `json:"changes"`
}

// StreamPhaseChangedPayload is the payload for stream:phase-changed events
type StreamPhaseChangedPayload struct {
	ProjectID string   `json:"projectId"`
	StreamID  string   `json:"streamId"`
	Phase     string   `json:"phase"`
	Artifacts []string `json:"artifacts"`
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
	ConversationID string        `json:"conversation_id"`
	Content        string        `json:"content"`
	Model          string        `json:"model"`
	Provider       string        `json:"provider"`
	SystemPrompt   string        `json:"system_prompt,omitempty"`
	APIKey         string        `json:"api_key"`
	History        []ChatMessage `json:"history,omitempty"`
}

// ChatMessage represents a message in conversation history sent via WebSocket.
// Maps to providers.Message for ChatService use.
type ChatMessage struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCallID string     `json:"toolCallId,omitempty"`
	ToolCalls  []ToolCall `json:"toolCalls,omitempty"`
	ToolName   string     `json:"toolName,omitempty"`
}

// ChatToolStartPayload is the payload for chat:tool-start events
type ChatToolStartPayload struct {
	ConversationID string                 `json:"conversation_id"`
	MessageID      string                 `json:"message_id"`
	ToolID         string                 `json:"tool_id"`
	ToolName       string                 `json:"tool_name"`
	Input          map[string]interface{} `json:"input"`
}

// ChatToolDeltaPayload is the payload for chat:tool-delta events
type ChatToolDeltaPayload struct {
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
	ToolID         string `json:"tool_id"`
	Chunk          string `json:"chunk"`
}

// ChatToolResultPayload is the payload for chat:tool-result events
type ChatToolResultPayload struct {
	ConversationID string                 `json:"conversation_id"`
	MessageID      string                 `json:"message_id"`
	ToolID         string                 `json:"tool_id"`
	Status         string                 `json:"status"` // "success" or "error"
	Result         string                 `json:"result"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// ChatToolConfirmPayload is the payload for chat:tool-confirm events
type ChatToolConfirmPayload struct {
	ConversationID string                 `json:"conversation_id"`
	MessageID      string                 `json:"message_id"`
	ToolID         string                 `json:"tool_id"`
	ToolName       string                 `json:"tool_name"`
	Input          map[string]interface{} `json:"input"`
}

// ChatToolApprovePayload is the payload for chat:tool-approve events (client → server)
type ChatToolApprovePayload struct {
	ToolID   string `json:"tool_id"`
	Approved bool   `json:"approved"`
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

// NewChatToolStartEvent creates a chat:tool-start event
func NewChatToolStartEvent(conversationID, messageID, toolID, toolName string, input map[string]interface{}) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatToolStart, &ChatToolStartPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		ToolID:         toolID,
		ToolName:       toolName,
		Input:          input,
	})
}

// NewChatToolDeltaEvent creates a chat:tool-delta event
func NewChatToolDeltaEvent(conversationID, messageID, toolID, chunk string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatToolDelta, &ChatToolDeltaPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		ToolID:         toolID,
		Chunk:          chunk,
	})
}

// NewChatToolResultEvent creates a chat:tool-result event
func NewChatToolResultEvent(conversationID, messageID, toolID, status, result string, metadata map[string]interface{}) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatToolResult, &ChatToolResultPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		ToolID:         toolID,
		Status:         status,
		Result:         result,
		Metadata:       metadata,
	})
}

// NewChatToolConfirmEvent creates a chat:tool-confirm event
func NewChatToolConfirmEvent(conversationID, messageID, toolID, toolName string, input map[string]interface{}) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeChatToolConfirm, &ChatToolConfirmPayload{
		ConversationID: conversationID,
		MessageID:      messageID,
		ToolID:         toolID,
		ToolName:       toolName,
		Input:          input,
	})
}

// NewArtifactStreamCreatedEvent creates an artifact:created event for stream-context artifacts
func NewArtifactStreamCreatedEvent(projectID, streamID, filename, phase string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeArtifactCreated, &ArtifactStreamEventPayload{
		ProjectID: projectID,
		StreamID:  streamID,
		Filename:  filename,
		Phase:     phase,
	})
}

// NewArtifactStreamUpdatedEvent creates an artifact:updated event for stream-context artifacts
func NewArtifactStreamUpdatedEvent(projectID, streamID, filename, phase string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeArtifactUpdated, &ArtifactStreamEventPayload{
		ProjectID: projectID,
		StreamID:  streamID,
		Filename:  filename,
		Phase:     phase,
	})
}

// NewArtifactStreamDeletedEvent creates an artifact:deleted event for stream-context artifacts
func NewArtifactStreamDeletedEvent(projectID, streamID, filename, phase string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeArtifactDeleted, &ArtifactStreamEventPayload{
		ProjectID: projectID,
		StreamID:  streamID,
		Filename:  filename,
		Phase:     phase,
	})
}

// NewStreamCreatedEvent creates a stream:created event
func NewStreamCreatedEvent(projectID, streamID, name string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeStreamCreated, &StreamCreatedPayload{
		ProjectID: projectID,
		StreamID:  streamID,
		Name:      name,
	})
}

// NewStreamArchivedEvent creates a stream:archived event
func NewStreamArchivedEvent(projectID, streamID, outcome string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeStreamArchived, &StreamArchivedPayload{
		ProjectID: projectID,
		StreamID:  streamID,
		Outcome:   outcome,
	})
}

// NewStreamUpdatedEvent creates a stream:updated event
func NewStreamUpdatedEvent(projectID, streamID string, changes map[string]interface{}) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeStreamUpdated, &StreamUpdatedPayload{
		ProjectID: projectID,
		StreamID:  streamID,
		Changes:   changes,
	})
}

// NewStreamPhaseChangedEvent creates a stream:phase-changed event
func NewStreamPhaseChangedEvent(projectID, streamID, phase string, artifacts []string) *WebSocketEvent {
	return NewWebSocketEvent(EventTypeStreamPhaseChanged, &StreamPhaseChangedPayload{
		ProjectID: projectID,
		StreamID:  streamID,
		Phase:     phase,
		Artifacts: artifacts,
	})
}
