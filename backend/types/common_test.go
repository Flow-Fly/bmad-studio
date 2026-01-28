package types

import (
	"encoding/json"
	"testing"
	"time"
)

func TestTimestampMarshalJSON(t *testing.T) {
	// Create a known timestamp
	ts := Timestamp(time.Date(2026, 1, 27, 10, 30, 0, 0, time.UTC))

	// Marshal to JSON
	data, err := json.Marshal(ts)
	if err != nil {
		t.Fatalf("Failed to marshal timestamp: %v", err)
	}

	// Should be ISO 8601 format
	expected := `"2026-01-27T10:30:00Z"`
	if string(data) != expected {
		t.Errorf("Expected %s, got %s", expected, string(data))
	}
}

func TestTimestampUnmarshalJSON(t *testing.T) {
	input := `"2026-01-27T10:30:00Z"`
	var ts Timestamp

	err := json.Unmarshal([]byte(input), &ts)
	if err != nil {
		t.Fatalf("Failed to unmarshal timestamp: %v", err)
	}

	// Verify the time was parsed correctly
	expected := time.Date(2026, 1, 27, 10, 30, 0, 0, time.UTC)
	if !ts.Time().Equal(expected) {
		t.Errorf("Expected %v, got %v", expected, ts.Time())
	}
}

func TestTimestampRoundTrip(t *testing.T) {
	original := Now()

	// Marshal
	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	// Unmarshal
	var parsed Timestamp
	err = json.Unmarshal(data, &parsed)
	if err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	// Compare (within 1 second due to format precision)
	if original.Time().Unix() != parsed.Time().Unix() {
		t.Errorf("Round trip failed: original %v, parsed %v", original.Time(), parsed.Time())
	}
}

func TestTimestampString(t *testing.T) {
	ts := Timestamp(time.Date(2026, 1, 27, 10, 30, 0, 0, time.UTC))
	expected := "2026-01-27T10:30:00Z"

	if ts.String() != expected {
		t.Errorf("Expected %s, got %s", expected, ts.String())
	}
}

func TestTimestampIsZero(t *testing.T) {
	var zeroTs Timestamp
	if !zeroTs.IsZero() {
		t.Error("Zero timestamp should report IsZero() == true")
	}

	nonZeroTs := Now()
	if nonZeroTs.IsZero() {
		t.Error("Non-zero timestamp should report IsZero() == false")
	}
}

func TestAPITypesJSONTags(t *testing.T) {
	// Test that JSON tags use snake_case
	project := Project{
		BaseEntity: BaseEntity{
			ID:        "proj-123",
			CreatedAt: Now(),
			UpdatedAt: Now(),
		},
		Name:        "Test Project",
		Path:        "/path/to/project",
		Description: "A test project",
	}

	data, err := json.Marshal(project)
	if err != nil {
		t.Fatalf("Failed to marshal project: %v", err)
	}

	// Check that snake_case fields are present
	jsonStr := string(data)
	requiredFields := []string{`"id"`, `"created_at"`, `"updated_at"`, `"name"`, `"path"`, `"description"`}
	for _, field := range requiredFields {
		if !containsField(jsonStr, field) {
			t.Errorf("JSON should contain snake_case field %s", field)
		}
	}

	// Check that camelCase fields are NOT present
	forbiddenFields := []string{`"createdAt"`, `"updatedAt"`, `"projectId"`, `"agentId"`}
	for _, field := range forbiddenFields {
		if containsField(jsonStr, field) {
			t.Errorf("JSON should NOT contain camelCase field %s", field)
		}
	}
}

func containsField(jsonStr, field string) bool {
	return len(jsonStr) > 0 && (jsonStr[0:1] == "{" || jsonStr[0:1] == "[") &&
		(len(field) > 0 && containsSubstring(jsonStr, field))
}

func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr) >= 0
}

func findSubstring(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
