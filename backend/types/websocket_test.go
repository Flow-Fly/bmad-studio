package types

import (
	"encoding/json"
	"testing"
	"time"
)

func TestWebSocketEventTypes(t *testing.T) {
	tests := []struct {
		name     string
		constant string
		expected string
	}{
		{"artifact created", EventTypeArtifactCreated, "artifact:created"},
		{"artifact updated", EventTypeArtifactUpdated, "artifact:updated"},
		{"artifact deleted", EventTypeArtifactDeleted, "artifact:deleted"},
		{"workflow status changed", EventTypeWorkflowStatusChanged, "workflow:status-changed"},
		{"connection status", EventTypeConnectionStatus, "connection:status"},
		{"chat send", EventTypeChatSend, "chat:send"},
		{"chat cancel", EventTypeChatCancel, "chat:cancel"},
		{"chat stream start", EventTypeChatStreamStart, "chat:stream-start"},
		{"chat text delta", EventTypeChatTextDelta, "chat:text-delta"},
		{"chat thinking delta", EventTypeChatThinkingDelta, "chat:thinking-delta"},
		{"chat stream end", EventTypeChatStreamEnd, "chat:stream-end"},
		{"chat error", EventTypeChatError, "chat:error"},
		{"chat tool start", EventTypeChatToolStart, "chat:tool-start"},
		{"chat tool delta", EventTypeChatToolDelta, "chat:tool-delta"},
		{"chat tool result", EventTypeChatToolResult, "chat:tool-result"},
		{"chat tool confirm", EventTypeChatToolConfirm, "chat:tool-confirm"},
		{"chat tool approve", EventTypeChatToolApprove, "chat:tool-approve"},
		{"stream created", EventTypeStreamCreated, "stream:created"},
		{"stream archived", EventTypeStreamArchived, "stream:archived"},
		{"stream updated", EventTypeStreamUpdated, "stream:updated"},
		{"stream phase changed", EventTypeStreamPhaseChanged, "stream:phase-changed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, tt.constant)
			}
		})
	}
}

func TestNewWebSocketEvent(t *testing.T) {
	before := time.Now().UTC()
	event := NewWebSocketEvent("test:event", map[string]string{"key": "value"})
	after := time.Now().UTC()

	if event.Type != "test:event" {
		t.Errorf("expected type %q, got %q", "test:event", event.Type)
	}

	if event.Timestamp.Before(before) || event.Timestamp.After(after) {
		t.Errorf("timestamp %v not between %v and %v", event.Timestamp, before, after)
	}

	payload, ok := event.Payload.(map[string]string)
	if !ok {
		t.Fatalf("expected payload type map[string]string, got %T", event.Payload)
	}
	if payload["key"] != "value" {
		t.Errorf("expected payload key=value, got key=%s", payload["key"])
	}
}

func TestNewArtifactCreatedEvent(t *testing.T) {
	parentID := "parent-123"
	artifact := &ArtifactResponse{
		ID:        "test-artifact",
		Name:      "Test Artifact",
		Type:      ArtifactTypePRD,
		Path:      "_bmad-output/planning-artifacts/prd.md",
		Status:    ArtifactStatusComplete,
		Phase:     2,
		PhaseName: "Planning",
		IsSharded: false,
		ParentID:  &parentID,
	}

	event := NewArtifactCreatedEvent(artifact)

	if event.Type != EventTypeArtifactCreated {
		t.Errorf("expected type %q, got %q", EventTypeArtifactCreated, event.Type)
	}

	payload, ok := event.Payload.(*ArtifactEventPayload)
	if !ok {
		t.Fatalf("expected payload type *ArtifactEventPayload, got %T", event.Payload)
	}

	if payload.ID != artifact.ID {
		t.Errorf("expected ID %q, got %q", artifact.ID, payload.ID)
	}
	if payload.Name != artifact.Name {
		t.Errorf("expected Name %q, got %q", artifact.Name, payload.Name)
	}
	if payload.Type != artifact.Type {
		t.Errorf("expected Type %q, got %q", artifact.Type, payload.Type)
	}
	if payload.Path != artifact.Path {
		t.Errorf("expected Path %q, got %q", artifact.Path, payload.Path)
	}
	if payload.Status != artifact.Status {
		t.Errorf("expected Status %q, got %q", artifact.Status, payload.Status)
	}
	if payload.Phase != artifact.Phase {
		t.Errorf("expected Phase %d, got %d", artifact.Phase, payload.Phase)
	}
	if payload.PhaseName != artifact.PhaseName {
		t.Errorf("expected PhaseName %q, got %q", artifact.PhaseName, payload.PhaseName)
	}
	if payload.IsSharded != artifact.IsSharded {
		t.Errorf("expected IsSharded %v, got %v", artifact.IsSharded, payload.IsSharded)
	}
	if *payload.ParentID != *artifact.ParentID {
		t.Errorf("expected ParentID %q, got %q", *artifact.ParentID, *payload.ParentID)
	}
}

func TestNewArtifactUpdatedEvent(t *testing.T) {
	artifact := &ArtifactResponse{
		ID:        "test-artifact",
		Name:      "Test Artifact",
		Type:      ArtifactTypePRD,
		Path:      "_bmad-output/planning-artifacts/prd.md",
		Status:    ArtifactStatusInProgress,
		Phase:     2,
		PhaseName: "Planning",
		IsSharded: false,
	}

	event := NewArtifactUpdatedEvent(artifact)

	if event.Type != EventTypeArtifactUpdated {
		t.Errorf("expected type %q, got %q", EventTypeArtifactUpdated, event.Type)
	}

	payload, ok := event.Payload.(*ArtifactEventPayload)
	if !ok {
		t.Fatalf("expected payload type *ArtifactEventPayload, got %T", event.Payload)
	}

	if payload.ID != artifact.ID {
		t.Errorf("expected ID %q, got %q", artifact.ID, payload.ID)
	}
}

func TestNewArtifactDeletedEvent(t *testing.T) {
	event := NewArtifactDeletedEvent("test-artifact", "_bmad-output/planning-artifacts/prd.md")

	if event.Type != EventTypeArtifactDeleted {
		t.Errorf("expected type %q, got %q", EventTypeArtifactDeleted, event.Type)
	}

	payload, ok := event.Payload.(*ArtifactDeletedPayload)
	if !ok {
		t.Fatalf("expected payload type *ArtifactDeletedPayload, got %T", event.Payload)
	}

	if payload.ID != "test-artifact" {
		t.Errorf("expected ID %q, got %q", "test-artifact", payload.ID)
	}
	if payload.Path != "_bmad-output/planning-artifacts/prd.md" {
		t.Errorf("expected Path %q, got %q", "_bmad-output/planning-artifacts/prd.md", payload.Path)
	}
}

func TestNewWorkflowStatusChangedEvent(t *testing.T) {
	statuses := map[string]WorkflowCompletionStatus{
		"prd": {
			WorkflowID: "prd",
			Status:     StatusComplete,
			IsComplete: true,
			IsRequired: true,
		},
	}

	event := NewWorkflowStatusChangedEvent(statuses)

	if event.Type != EventTypeWorkflowStatusChanged {
		t.Errorf("expected type %q, got %q", EventTypeWorkflowStatusChanged, event.Type)
	}

	payload, ok := event.Payload.(*WorkflowStatusEventPayload)
	if !ok {
		t.Fatalf("expected payload type *WorkflowStatusEventPayload, got %T", event.Payload)
	}

	if len(payload.WorkflowStatuses) != 1 {
		t.Errorf("expected 1 workflow status, got %d", len(payload.WorkflowStatuses))
	}

	prdStatus, ok := payload.WorkflowStatuses["prd"]
	if !ok {
		t.Fatal("expected prd status to exist")
	}
	if prdStatus.WorkflowID != "prd" {
		t.Errorf("expected WorkflowID %q, got %q", "prd", prdStatus.WorkflowID)
	}
	if !prdStatus.IsComplete {
		t.Error("expected IsComplete to be true")
	}
}

func TestWebSocketEventJSONSerialization(t *testing.T) {
	artifact := &ArtifactResponse{
		ID:        "test-artifact",
		Name:      "Test Artifact",
		Type:      ArtifactTypePRD,
		Path:      "_bmad-output/planning-artifacts/prd.md",
		Status:    ArtifactStatusComplete,
		Phase:     2,
		PhaseName: "Planning",
		IsSharded: false,
	}

	event := NewArtifactCreatedEvent(artifact)

	// Serialize to JSON
	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("failed to marshal event: %v", err)
	}

	// Verify it contains expected fields
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal event: %v", err)
	}

	if result["type"] != EventTypeArtifactCreated {
		t.Errorf("expected type %q, got %q", EventTypeArtifactCreated, result["type"])
	}

	payload, ok := result["payload"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected payload to be map, got %T", result["payload"])
	}

	if payload["id"] != "test-artifact" {
		t.Errorf("expected id %q, got %q", "test-artifact", payload["id"])
	}

	// Timestamp should be present and valid ISO 8601
	timestamp, ok := result["timestamp"].(string)
	if !ok {
		t.Fatalf("expected timestamp to be string, got %T", result["timestamp"])
	}
	if _, err := time.Parse(time.RFC3339Nano, timestamp); err != nil {
		t.Errorf("timestamp %q is not valid RFC3339: %v", timestamp, err)
	}
}

func TestArtifactEventPayloadJSONTags(t *testing.T) {
	parentID := "parent-123"
	payload := &ArtifactEventPayload{
		ID:        "test",
		Name:      "Test",
		Type:      "prd",
		Path:      "/path/to/file.md",
		Status:    "complete",
		Phase:     2,
		PhaseName: "Planning",
		IsSharded: true,
		ParentID:  &parentID,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// Verify camelCase JSON tags
	if _, ok := result["phaseName"]; !ok {
		t.Error("expected phaseName field (camelCase)")
	}
	if _, ok := result["isSharded"]; !ok {
		t.Error("expected isSharded field (camelCase)")
	}
	if _, ok := result["parentId"]; !ok {
		t.Error("expected parentId field (camelCase)")
	}
}

func TestArtifactDeletedPayloadOmitsEmptyParentID(t *testing.T) {
	// ArtifactEventPayload with nil ParentID should omit parent_id
	payload := &ArtifactEventPayload{
		ID:        "test",
		Name:      "Test",
		Type:      "prd",
		Path:      "/path/to/file.md",
		Status:    "complete",
		Phase:     2,
		PhaseName: "Planning",
		IsSharded: false,
		ParentID:  nil,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// parentId should be omitted when nil (due to omitempty)
	if _, ok := result["parentId"]; ok {
		t.Error("expected parentId to be omitted when nil")
	}
}

func TestNewChatStreamStartEvent(t *testing.T) {
	event := NewChatStreamStartEvent("conv-1", "msg-1", "claude-sonnet-4-5-20250929")

	if event.Type != EventTypeChatStreamStart {
		t.Errorf("expected type %q, got %q", EventTypeChatStreamStart, event.Type)
	}

	payload, ok := event.Payload.(*ChatStreamStartPayload)
	if !ok {
		t.Fatalf("expected *ChatStreamStartPayload, got %T", event.Payload)
	}
	if payload.ConversationID != "conv-1" {
		t.Errorf("expected ConversationID %q, got %q", "conv-1", payload.ConversationID)
	}
	if payload.MessageID != "msg-1" {
		t.Errorf("expected MessageID %q, got %q", "msg-1", payload.MessageID)
	}
	if payload.Model != "claude-sonnet-4-5-20250929" {
		t.Errorf("expected Model %q, got %q", "claude-sonnet-4-5-20250929", payload.Model)
	}
}

func TestNewChatTextDeltaEvent(t *testing.T) {
	event := NewChatTextDeltaEvent("conv-1", "msg-1", "Hello", 0)

	if event.Type != EventTypeChatTextDelta {
		t.Errorf("expected type %q, got %q", EventTypeChatTextDelta, event.Type)
	}

	payload, ok := event.Payload.(*ChatTextDeltaPayload)
	if !ok {
		t.Fatalf("expected *ChatTextDeltaPayload, got %T", event.Payload)
	}
	if payload.Content != "Hello" {
		t.Errorf("expected Content %q, got %q", "Hello", payload.Content)
	}
	if payload.Index != 0 {
		t.Errorf("expected Index 0, got %d", payload.Index)
	}
}

func TestNewChatThinkingDeltaEvent(t *testing.T) {
	event := NewChatThinkingDeltaEvent("conv-1", "msg-1", "Let me think...", 0)

	if event.Type != EventTypeChatThinkingDelta {
		t.Errorf("expected type %q, got %q", EventTypeChatThinkingDelta, event.Type)
	}

	payload, ok := event.Payload.(*ChatThinkingDeltaPayload)
	if !ok {
		t.Fatalf("expected *ChatThinkingDeltaPayload, got %T", event.Payload)
	}
	if payload.Content != "Let me think..." {
		t.Errorf("expected Content %q, got %q", "Let me think...", payload.Content)
	}
}

func TestNewChatStreamEndEvent(t *testing.T) {
	usage := &UsageStats{InputTokens: 100, OutputTokens: 200}
	event := NewChatStreamEndEvent("conv-1", "msg-1", usage, false)

	if event.Type != EventTypeChatStreamEnd {
		t.Errorf("expected type %q, got %q", EventTypeChatStreamEnd, event.Type)
	}

	payload, ok := event.Payload.(*ChatStreamEndPayload)
	if !ok {
		t.Fatalf("expected *ChatStreamEndPayload, got %T", event.Payload)
	}
	if payload.Usage == nil {
		t.Fatal("expected Usage to be non-nil")
	}
	if payload.Usage.InputTokens != 100 {
		t.Errorf("expected InputTokens 100, got %d", payload.Usage.InputTokens)
	}
	if payload.Usage.OutputTokens != 200 {
		t.Errorf("expected OutputTokens 200, got %d", payload.Usage.OutputTokens)
	}
	if payload.Partial {
		t.Error("expected Partial to be false")
	}
}

func TestNewChatStreamEndEvent_Partial(t *testing.T) {
	event := NewChatStreamEndEvent("conv-1", "msg-1", nil, true)

	payload, ok := event.Payload.(*ChatStreamEndPayload)
	if !ok {
		t.Fatalf("expected *ChatStreamEndPayload, got %T", event.Payload)
	}
	if !payload.Partial {
		t.Error("expected Partial to be true")
	}
	if payload.Usage != nil {
		t.Error("expected Usage to be nil for partial response")
	}
}

func TestNewChatErrorEvent(t *testing.T) {
	event := NewChatErrorEvent("conv-1", "msg-1", "provider_timeout", "Request timed out")

	if event.Type != EventTypeChatError {
		t.Errorf("expected type %q, got %q", EventTypeChatError, event.Type)
	}

	payload, ok := event.Payload.(*ChatErrorPayload)
	if !ok {
		t.Fatalf("expected *ChatErrorPayload, got %T", event.Payload)
	}
	if payload.Code != "provider_timeout" {
		t.Errorf("expected Code %q, got %q", "provider_timeout", payload.Code)
	}
	if payload.Message != "Request timed out" {
		t.Errorf("expected Message %q, got %q", "Request timed out", payload.Message)
	}
}

func TestNewChatToolStartEvent(t *testing.T) {
	input := map[string]interface{}{"path": "test.txt"}
	event := NewChatToolStartEvent("conv-1", "msg-1", "toolu_1", "file_read", input)

	if event.Type != EventTypeChatToolStart {
		t.Errorf("expected type %q, got %q", EventTypeChatToolStart, event.Type)
	}

	payload, ok := event.Payload.(*ChatToolStartPayload)
	if !ok {
		t.Fatalf("expected *ChatToolStartPayload, got %T", event.Payload)
	}
	if payload.ToolID != "toolu_1" {
		t.Errorf("expected ToolID %q, got %q", "toolu_1", payload.ToolID)
	}
	if payload.ToolName != "file_read" {
		t.Errorf("expected ToolName %q, got %q", "file_read", payload.ToolName)
	}
	if payload.Input["path"] != "test.txt" {
		t.Errorf("expected input path %q, got %v", "test.txt", payload.Input["path"])
	}
}

func TestNewChatToolDeltaEvent(t *testing.T) {
	event := NewChatToolDeltaEvent("conv-1", "msg-1", "toolu_1", `{"partial":"json"}`)

	if event.Type != EventTypeChatToolDelta {
		t.Errorf("expected type %q, got %q", EventTypeChatToolDelta, event.Type)
	}

	payload, ok := event.Payload.(*ChatToolDeltaPayload)
	if !ok {
		t.Fatalf("expected *ChatToolDeltaPayload, got %T", event.Payload)
	}
	if payload.Chunk != `{"partial":"json"}` {
		t.Errorf("expected chunk %q, got %q", `{"partial":"json"}`, payload.Chunk)
	}
}

func TestNewChatToolResultEvent(t *testing.T) {
	metadata := map[string]interface{}{"exitCode": float64(0)}
	event := NewChatToolResultEvent("conv-1", "msg-1", "toolu_1", "success", "file contents", metadata)

	if event.Type != EventTypeChatToolResult {
		t.Errorf("expected type %q, got %q", EventTypeChatToolResult, event.Type)
	}

	payload, ok := event.Payload.(*ChatToolResultPayload)
	if !ok {
		t.Fatalf("expected *ChatToolResultPayload, got %T", event.Payload)
	}
	if payload.Status != "success" {
		t.Errorf("expected status %q, got %q", "success", payload.Status)
	}
	if payload.Result != "file contents" {
		t.Errorf("expected result %q, got %q", "file contents", payload.Result)
	}
	if payload.Metadata["exitCode"] != float64(0) {
		t.Errorf("expected exitCode 0, got %v", payload.Metadata["exitCode"])
	}
}

func TestNewChatToolConfirmEvent(t *testing.T) {
	input := map[string]interface{}{"command": "rm -rf /tmp/test"}
	event := NewChatToolConfirmEvent("conv-1", "msg-1", "toolu_1", "bash", input)

	if event.Type != EventTypeChatToolConfirm {
		t.Errorf("expected type %q, got %q", EventTypeChatToolConfirm, event.Type)
	}

	payload, ok := event.Payload.(*ChatToolConfirmPayload)
	if !ok {
		t.Fatalf("expected *ChatToolConfirmPayload, got %T", event.Payload)
	}
	if payload.ToolName != "bash" {
		t.Errorf("expected ToolName %q, got %q", "bash", payload.ToolName)
	}
}

func TestToolEventPayloadJSONSerialization(t *testing.T) {
	input := map[string]interface{}{"path": "test.txt"}
	event := NewChatToolStartEvent("conv-1", "msg-1", "toolu_1", "file_read", input)

	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	payload := result["payload"].(map[string]interface{})
	if payload["conversation_id"] != "conv-1" {
		t.Errorf("expected conversation_id %q, got %v", "conv-1", payload["conversation_id"])
	}
	if payload["tool_id"] != "toolu_1" {
		t.Errorf("expected tool_id %q, got %v", "toolu_1", payload["tool_id"])
	}
	if payload["tool_name"] != "file_read" {
		t.Errorf("expected tool_name %q, got %v", "file_read", payload["tool_name"])
	}
}

func TestChatSendPayloadWithHistory(t *testing.T) {
	payload := ChatSendPayload{
		ConversationID: "conv-1",
		Content:        "hello",
		Model:          "claude-sonnet",
		Provider:       "claude",
		APIKey:         "key",
		History: []ChatMessage{
			{Role: "user", Content: "previous message"},
			{Role: "assistant", Content: "previous response"},
		},
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	history, ok := result["history"].([]interface{})
	if !ok {
		t.Fatalf("expected history to be array, got %T", result["history"])
	}
	if len(history) != 2 {
		t.Errorf("expected 2 history messages, got %d", len(history))
	}
}

func TestChatSendPayloadHistoryOmitted(t *testing.T) {
	payload := ChatSendPayload{
		ConversationID: "conv-1",
		Content:        "hello",
		Model:          "claude-sonnet",
		Provider:       "claude",
		APIKey:         "key",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if _, ok := result["history"]; ok {
		t.Error("expected history to be omitted when empty")
	}
}

func TestChatEventPayloadJSONSerialization(t *testing.T) {
	tests := []struct {
		name  string
		event *WebSocketEvent
		check func(t *testing.T, result map[string]interface{})
	}{
		{
			name:  "stream start",
			event: NewChatStreamStartEvent("conv-1", "msg-1", "claude-sonnet-4-5-20250929"),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				if payload["conversation_id"] != "conv-1" {
					t.Errorf("expected conversation_id conv-1, got %v", payload["conversation_id"])
				}
				if payload["message_id"] != "msg-1" {
					t.Errorf("expected message_id msg-1, got %v", payload["message_id"])
				}
				if payload["model"] != "claude-sonnet-4-5-20250929" {
					t.Errorf("expected model claude-sonnet-4-5-20250929, got %v", payload["model"])
				}
			},
		},
		{
			name:  "text delta",
			event: NewChatTextDeltaEvent("conv-1", "msg-1", "Hello", 5),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				if payload["content"] != "Hello" {
					t.Errorf("expected content Hello, got %v", payload["content"])
				}
				if payload["index"].(float64) != 5 {
					t.Errorf("expected index 5, got %v", payload["index"])
				}
			},
		},
		{
			name:  "stream end with usage",
			event: NewChatStreamEndEvent("conv-1", "msg-1", &UsageStats{InputTokens: 50, OutputTokens: 100}, false),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				usage := payload["usage"].(map[string]interface{})
				if usage["input_tokens"].(float64) != 50 {
					t.Errorf("expected input_tokens 50, got %v", usage["input_tokens"])
				}
				if usage["output_tokens"].(float64) != 100 {
					t.Errorf("expected output_tokens 100, got %v", usage["output_tokens"])
				}
				if payload["partial"].(bool) != false {
					t.Error("expected partial false")
				}
			},
		},
		{
			name:  "error",
			event: NewChatErrorEvent("conv-1", "msg-1", "rate_limited", "Too many requests"),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				if payload["code"] != "rate_limited" {
					t.Errorf("expected code rate_limited, got %v", payload["code"])
				}
				if payload["message"] != "Too many requests" {
					t.Errorf("expected message 'Too many requests', got %v", payload["message"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.event)
			if err != nil {
				t.Fatalf("failed to marshal: %v", err)
			}

			var result map[string]interface{}
			if err := json.Unmarshal(data, &result); err != nil {
				t.Fatalf("failed to unmarshal: %v", err)
			}

			tt.check(t, result)
		})
	}
}

func TestNewStreamCreatedEvent(t *testing.T) {
	event := NewStreamCreatedEvent("proj-1", "stream-1", "Feature Development")

	if event.Type != EventTypeStreamCreated {
		t.Errorf("expected type %q, got %q", EventTypeStreamCreated, event.Type)
	}

	payload, ok := event.Payload.(*StreamCreatedPayload)
	if !ok {
		t.Fatalf("expected *StreamCreatedPayload, got %T", event.Payload)
	}
	if payload.ProjectID != "proj-1" {
		t.Errorf("expected ProjectID %q, got %q", "proj-1", payload.ProjectID)
	}
	if payload.StreamID != "stream-1" {
		t.Errorf("expected StreamID %q, got %q", "stream-1", payload.StreamID)
	}
	if payload.Name != "Feature Development" {
		t.Errorf("expected Name %q, got %q", "Feature Development", payload.Name)
	}
}

func TestNewStreamArchivedEvent(t *testing.T) {
	event := NewStreamArchivedEvent("proj-1", "stream-1", "completed")

	if event.Type != EventTypeStreamArchived {
		t.Errorf("expected type %q, got %q", EventTypeStreamArchived, event.Type)
	}

	payload, ok := event.Payload.(*StreamArchivedPayload)
	if !ok {
		t.Fatalf("expected *StreamArchivedPayload, got %T", event.Payload)
	}
	if payload.Outcome != "completed" {
		t.Errorf("expected Outcome %q, got %q", "completed", payload.Outcome)
	}
}

func TestNewStreamUpdatedEvent(t *testing.T) {
	changes := map[string]interface{}{"name": "New Name"}
	event := NewStreamUpdatedEvent("proj-1", "stream-1", changes)

	if event.Type != EventTypeStreamUpdated {
		t.Errorf("expected type %q, got %q", EventTypeStreamUpdated, event.Type)
	}

	payload, ok := event.Payload.(*StreamUpdatedPayload)
	if !ok {
		t.Fatalf("expected *StreamUpdatedPayload, got %T", event.Payload)
	}
	if payload.Changes["name"] != "New Name" {
		t.Errorf("expected changes name %q, got %v", "New Name", payload.Changes["name"])
	}
}

func TestNewStreamPhaseChangedEvent(t *testing.T) {
	artifacts := []string{"artifact-1", "artifact-2"}
	event := NewStreamPhaseChangedEvent("proj-1", "stream-1", "development", artifacts)

	if event.Type != EventTypeStreamPhaseChanged {
		t.Errorf("expected type %q, got %q", EventTypeStreamPhaseChanged, event.Type)
	}

	payload, ok := event.Payload.(*StreamPhaseChangedPayload)
	if !ok {
		t.Fatalf("expected *StreamPhaseChangedPayload, got %T", event.Payload)
	}
	if payload.Phase != "development" {
		t.Errorf("expected Phase %q, got %q", "development", payload.Phase)
	}
	if len(payload.Artifacts) != 2 {
		t.Errorf("expected 2 artifacts, got %d", len(payload.Artifacts))
	}
}

func TestStreamEventPayloadJSONSerialization(t *testing.T) {
	tests := []struct {
		name  string
		event *WebSocketEvent
		check func(t *testing.T, result map[string]interface{})
	}{
		{
			name:  "stream created",
			event: NewStreamCreatedEvent("proj-1", "stream-1", "Feature Dev"),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				if payload["projectId"] != "proj-1" {
					t.Errorf("expected projectId proj-1, got %v", payload["projectId"])
				}
				if payload["streamId"] != "stream-1" {
					t.Errorf("expected streamId stream-1, got %v", payload["streamId"])
				}
				if payload["name"] != "Feature Dev" {
					t.Errorf("expected name 'Feature Dev', got %v", payload["name"])
				}
			},
		},
		{
			name:  "stream archived",
			event: NewStreamArchivedEvent("proj-1", "stream-1", "completed"),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				if payload["outcome"] != "completed" {
					t.Errorf("expected outcome completed, got %v", payload["outcome"])
				}
			},
		},
		{
			name:  "stream updated",
			event: NewStreamUpdatedEvent("proj-1", "stream-1", map[string]interface{}{"name": "Updated"}),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				changes := payload["changes"].(map[string]interface{})
				if changes["name"] != "Updated" {
					t.Errorf("expected changes name Updated, got %v", changes["name"])
				}
			},
		},
		{
			name:  "stream phase changed",
			event: NewStreamPhaseChangedEvent("proj-1", "stream-1", "implementation", []string{"art-1"}),
			check: func(t *testing.T, result map[string]interface{}) {
				payload := result["payload"].(map[string]interface{})
				if payload["phase"] != "implementation" {
					t.Errorf("expected phase implementation, got %v", payload["phase"])
				}
				artifacts := payload["artifacts"].([]interface{})
				if len(artifacts) != 1 {
					t.Errorf("expected 1 artifact, got %d", len(artifacts))
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.event)
			if err != nil {
				t.Fatalf("failed to marshal: %v", err)
			}

			var result map[string]interface{}
			if err := json.Unmarshal(data, &result); err != nil {
				t.Fatalf("failed to unmarshal: %v", err)
			}

			tt.check(t, result)
		})
	}
}
