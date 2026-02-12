package types

import (
	"encoding/json"
	"testing"
)

func TestToolCategoryConstants(t *testing.T) {
	tests := []struct {
		name     string
		category ToolCategory
		expected string
	}{
		{"file", ToolCategoryFile, "file"},
		{"exec", ToolCategoryExec, "exec"},
		{"search", ToolCategorySearch, "search"},
		{"mcp", ToolCategoryMCP, "mcp"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.category) != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, string(tt.category))
			}
		})
	}
}

func TestDangerLevelConstants(t *testing.T) {
	tests := []struct {
		name     string
		level    DangerLevel
		expected string
	}{
		{"safe", DangerLevelSafe, "safe"},
		{"dangerous", DangerLevelDangerous, "dangerous"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.level) != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, string(tt.level))
			}
		})
	}
}

func TestTrustLevelConstants(t *testing.T) {
	tests := []struct {
		name     string
		level    TrustLevel
		expected string
	}{
		{"supervised", TrustLevelSupervised, "supervised"},
		{"guided", TrustLevelGuided, "guided"},
		{"autonomous", TrustLevelAutonomous, "autonomous"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if string(tt.level) != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, string(tt.level))
			}
		})
	}
}

func TestToolCallJSONSerialization(t *testing.T) {
	tc := ToolCall{
		ID:    "toolu_123",
		Name:  "file_read",
		Input: json.RawMessage(`{"path":"test.txt"}`),
	}

	data, err := json.Marshal(tc)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result["id"] != "toolu_123" {
		t.Errorf("expected id %q, got %v", "toolu_123", result["id"])
	}
	if result["name"] != "file_read" {
		t.Errorf("expected name %q, got %v", "file_read", result["name"])
	}

	input, ok := result["input"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected input to be map, got %T", result["input"])
	}
	if input["path"] != "test.txt" {
		t.Errorf("expected path %q, got %v", "test.txt", input["path"])
	}
}

func TestToolCallJSONDeserialization(t *testing.T) {
	raw := `{"id":"toolu_456","name":"bash","input":{"command":"echo hi"}}`

	var tc ToolCall
	if err := json.Unmarshal([]byte(raw), &tc); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if tc.ID != "toolu_456" {
		t.Errorf("expected ID %q, got %q", "toolu_456", tc.ID)
	}
	if tc.Name != "bash" {
		t.Errorf("expected Name %q, got %q", "bash", tc.Name)
	}

	var input map[string]string
	if err := json.Unmarshal(tc.Input, &input); err != nil {
		t.Fatalf("failed to unmarshal input: %v", err)
	}
	if input["command"] != "echo hi" {
		t.Errorf("expected command %q, got %q", "echo hi", input["command"])
	}
}

func TestToolDefinitionJSONSerialization(t *testing.T) {
	td := ToolDefinition{
		Name:        "file_read",
		Description: "Read file contents",
		InputSchema: json.RawMessage(`{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}`),
	}

	data, err := json.Marshal(td)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result["name"] != "file_read" {
		t.Errorf("expected name %q, got %v", "file_read", result["name"])
	}
	if result["description"] != "Read file contents" {
		t.Errorf("expected description %q, got %v", "Read file contents", result["description"])
	}
	if _, ok := result["inputSchema"]; !ok {
		t.Error("expected inputSchema field")
	}
}

func TestToolScopeJSONSerialization(t *testing.T) {
	scope := ToolScope{
		Permissions: map[string]ToolPermission{
			"file_read": {Allowed: true},
			"bash":      {Allowed: true, Timeout: "30s"},
			"file_write": {
				Allowed: true,
				Paths:   []string{"/src", "/tests"},
			},
		},
	}

	data, err := json.Marshal(scope)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var roundTrip ToolScope
	if err := json.Unmarshal(data, &roundTrip); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(roundTrip.Permissions) != 3 {
		t.Errorf("expected 3 permissions, got %d", len(roundTrip.Permissions))
	}
	if !roundTrip.Permissions["file_read"].Allowed {
		t.Error("expected file_read to be allowed")
	}
	if roundTrip.Permissions["bash"].Timeout != "30s" {
		t.Errorf("expected bash timeout %q, got %q", "30s", roundTrip.Permissions["bash"].Timeout)
	}
	if len(roundTrip.Permissions["file_write"].Paths) != 2 {
		t.Errorf("expected 2 paths for file_write, got %d", len(roundTrip.Permissions["file_write"].Paths))
	}
}

func TestToolCallZeroValue(t *testing.T) {
	var tc ToolCall
	data, err := json.Marshal(tc)
	if err != nil {
		t.Fatalf("failed to marshal zero value: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result["id"] != "" {
		t.Errorf("expected empty id, got %v", result["id"])
	}
	if result["name"] != "" {
		t.Errorf("expected empty name, got %v", result["name"])
	}
}

func TestToolDefinitionZeroValue(t *testing.T) {
	var td ToolDefinition
	data, err := json.Marshal(td)
	if err != nil {
		t.Fatalf("failed to marshal zero value: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if result["name"] != "" {
		t.Errorf("expected empty name, got %v", result["name"])
	}
}
