package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"bmad-studio/backend/api/websocket"
	"bmad-studio/backend/tools"
	"bmad-studio/backend/types"
)

const approvalTimeout = 30 * time.Second

// ToolOrchestrator executes tool calls, manages trust level checks,
// and coordinates user approval for dangerous operations.
type ToolOrchestrator struct {
	registry   *tools.ToolRegistry
	sandbox    *tools.Sandbox
	hub        *websocket.Hub
	approvals  map[string]chan bool
	approvalMu sync.Mutex
}

// NewToolOrchestrator creates a new ToolOrchestrator.
func NewToolOrchestrator(registry *tools.ToolRegistry, sandbox *tools.Sandbox, hub *websocket.Hub) *ToolOrchestrator {
	return &ToolOrchestrator{
		registry:  registry,
		sandbox:   sandbox,
		hub:       hub,
		approvals: make(map[string]chan bool),
	}
}

// HandleToolCall executes a single tool call and returns the result.
// Broadcasts tool-start and tool-result events via Hub.
// For dangerous tools in Guided/Supervised mode, sends tool-confirm
// and blocks until tool-approve received or timeout.
func (o *ToolOrchestrator) HandleToolCall(
	ctx context.Context,
	client *websocket.Client,
	conversationID string,
	messageID string,
	toolCall types.ToolCall,
	trustLevel types.TrustLevel,
) (*tools.ToolResult, error) {
	tool := o.registry.Get(toolCall.Name)
	if tool == nil {
		return nil, fmt.Errorf("unknown tool: %s", toolCall.Name)
	}

	// Parse input for event payloads
	var inputMap map[string]interface{}
	if len(toolCall.Input) > 0 {
		if err := json.Unmarshal(toolCall.Input, &inputMap); err != nil {
			inputMap = map[string]interface{}{"raw": string(toolCall.Input)}
		}
	}

	// Check trust level — may require user confirmation
	if o.NeedsConfirmation(toolCall.Name, trustLevel) {
		approved, err := o.requestApproval(ctx, client, conversationID, messageID, toolCall.ID, toolCall.Name, inputMap)
		if err != nil {
			return &tools.ToolResult{
				Output:  fmt.Sprintf("tool approval failed: %v", err),
				IsError: true,
			}, nil
		}
		if !approved {
			return &tools.ToolResult{
				Output:  "tool execution denied by user",
				IsError: true,
			}, nil
		}
	}

	// Note: tool-start event is already sent by relayStream when ChunkTypeToolCallStart
	// arrives, giving immediate UI feedback. No duplicate needed here.

	// Execute tool
	result, err := tool.Execute(ctx, toolCall.Input)
	if err != nil {
		// System error (e.g., sandbox violation) — broadcast error result, return error
		errorResult := types.NewChatToolResultEvent(conversationID, messageID, toolCall.ID, "error", err.Error(), nil)
		if sendErr := o.hub.SendToClient(client, errorResult); sendErr != nil {
			log.Printf("ToolOrchestrator: failed to send tool-result: %v", sendErr)
		}
		return nil, err
	}

	// Broadcast tool-result
	status := "success"
	if result.IsError {
		status = "error"
	}
	resultEvent := types.NewChatToolResultEvent(conversationID, messageID, toolCall.ID, status, result.Output, result.Metadata)
	if err := o.hub.SendToClient(client, resultEvent); err != nil {
		log.Printf("ToolOrchestrator: failed to send tool-result: %v", err)
	}

	return result, nil
}

// NeedsConfirmation returns true if the tool requires user approval
// given the current trust level.
func (o *ToolOrchestrator) NeedsConfirmation(toolName string, trustLevel types.TrustLevel) bool {
	switch trustLevel {
	case types.TrustLevelSupervised:
		return true
	case types.TrustLevelGuided:
		tool := o.registry.Get(toolName)
		if tool == nil {
			return true // unknown tools always need confirmation
		}
		return tool.DangerLevel == types.DangerLevelDangerous
	case types.TrustLevelAutonomous:
		return false
	default:
		return true // default to safest behavior
	}
}

// HandleApproval routes a user's approval/denial to the pending tool call.
func (o *ToolOrchestrator) HandleApproval(toolID string, approved bool) {
	o.approvalMu.Lock()
	ch, ok := o.approvals[toolID]
	if ok {
		delete(o.approvals, toolID)
	}
	o.approvalMu.Unlock()

	if ok {
		ch <- approved
	}
}

// requestApproval sends a tool-confirm event and waits for user response.
func (o *ToolOrchestrator) requestApproval(
	ctx context.Context,
	client *websocket.Client,
	conversationID, messageID, toolID, toolName string,
	input map[string]interface{},
) (bool, error) {
	ch := make(chan bool, 1)

	o.approvalMu.Lock()
	o.approvals[toolID] = ch
	o.approvalMu.Unlock()

	defer func() {
		o.approvalMu.Lock()
		delete(o.approvals, toolID)
		o.approvalMu.Unlock()
	}()

	// Send confirm event
	confirmEvent := types.NewChatToolConfirmEvent(conversationID, messageID, toolID, toolName, input)
	if err := o.hub.SendToClient(client, confirmEvent); err != nil {
		return false, fmt.Errorf("failed to send confirmation request: %w", err)
	}

	// Wait for approval, timeout, or context cancellation
	select {
	case approved := <-ch:
		return approved, nil
	case <-time.After(approvalTimeout):
		return false, fmt.Errorf("approval timed out after %v", approvalTimeout)
	case <-ctx.Done():
		return false, ctx.Err()
	}
}
