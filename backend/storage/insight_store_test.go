package storage

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"bmad-studio/backend/types"
)

func testInsight() types.Insight {
	return types.Insight{
		ID:                  "test-insight-001",
		Title:               "Test Insight",
		OriginContext:       "",
		ExtractedIdea:       "",
		Tags:                []string{},
		HighlightColorsUsed: []string{"yellow"},
		CreatedAt:           "2026-02-04T10:00:00Z",
		SourceAgent:         "Analyst",
		Status:              "fresh",
		UsedInCount:         0,
	}
}

func TestSaveInsight_CreatesFileInCorrectPath(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	insight := testInsight()
	err := store.SaveInsight("my-project", insight)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedPath := filepath.Join(dir, "my-project", "insights", insight.ID+".json")
	if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
		t.Fatalf("insight file should exist at %s", expectedPath)
	}

	data, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}

	var loaded types.Insight
	if err := json.Unmarshal(data, &loaded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if loaded.ID != insight.ID {
		t.Errorf("expected id %q, got %q", insight.ID, loaded.ID)
	}
	if loaded.Title != insight.Title {
		t.Errorf("expected title %q, got %q", insight.Title, loaded.Title)
	}
	if loaded.Status != insight.Status {
		t.Errorf("expected status %q, got %q", insight.Status, loaded.Status)
	}
	if loaded.SourceAgent != insight.SourceAgent {
		t.Errorf("expected source agent %q, got %q", insight.SourceAgent, loaded.SourceAgent)
	}
}

func TestSaveInsight_CreatesDirectoryIfMissing(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	insight := testInsight()
	err := store.SaveInsight("new-project", insight)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	insightsDir := filepath.Join(dir, "new-project", "insights")
	info, err := os.Stat(insightsDir)
	if err != nil {
		t.Fatalf("insights directory should exist: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected a directory")
	}
}

func TestSaveInsight_OverwritesExistingFile(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	insight := testInsight()
	if err := store.SaveInsight("my-project", insight); err != nil {
		t.Fatalf("first save error: %v", err)
	}

	insight.Title = "Updated Title"
	if err := store.SaveInsight("my-project", insight); err != nil {
		t.Fatalf("second save error: %v", err)
	}

	expectedPath := filepath.Join(dir, "my-project", "insights", insight.ID+".json")
	data, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}

	var loaded types.Insight
	if err := json.Unmarshal(data, &loaded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if loaded.Title != "Updated Title" {
		t.Errorf("expected updated title, got %q", loaded.Title)
	}
}

func TestListInsights_ReturnsAllSorted(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	older := testInsight()
	older.ID = "older"
	older.CreatedAt = "2026-01-01T00:00:00Z"

	newer := testInsight()
	newer.ID = "newer"
	newer.CreatedAt = "2026-02-01T00:00:00Z"

	if err := store.SaveInsight("my-project", older); err != nil {
		t.Fatalf("save older: %v", err)
	}
	if err := store.SaveInsight("my-project", newer); err != nil {
		t.Fatalf("save newer: %v", err)
	}

	insights, err := store.ListInsights("my-project")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}

	if len(insights) != 2 {
		t.Fatalf("expected 2 insights, got %d", len(insights))
	}

	// Should be sorted by created_at descending (newer first)
	if insights[0].ID != "newer" {
		t.Errorf("expected first insight to be 'newer', got %q", insights[0].ID)
	}
	if insights[1].ID != "older" {
		t.Errorf("expected second insight to be 'older', got %q", insights[1].ID)
	}
}

func TestListInsights_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	insights, err := store.ListInsights("nonexistent-project")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}

	if len(insights) != 0 {
		t.Fatalf("expected 0 insights, got %d", len(insights))
	}
}

func TestGetInsight_ReturnsCorrectInsight(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	insight := testInsight()
	if err := store.SaveInsight("my-project", insight); err != nil {
		t.Fatalf("save error: %v", err)
	}

	loaded, err := store.GetInsight("my-project", insight.ID)
	if err != nil {
		t.Fatalf("get error: %v", err)
	}

	if loaded.ID != insight.ID {
		t.Errorf("expected id %q, got %q", insight.ID, loaded.ID)
	}
	if loaded.Title != insight.Title {
		t.Errorf("expected title %q, got %q", insight.Title, loaded.Title)
	}
}

func TestGetInsight_NotFound(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	_, err := store.GetInsight("my-project", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent insight")
	}
}

func TestDeleteInsight_RemovesFile(t *testing.T) {
	dir := t.TempDir()
	store := NewInsightStoreWithPath(dir)

	insight := testInsight()
	if err := store.SaveInsight("my-project", insight); err != nil {
		t.Fatalf("save error: %v", err)
	}

	err := store.DeleteInsight("my-project", insight.ID)
	if err != nil {
		t.Fatalf("delete error: %v", err)
	}

	expectedPath := filepath.Join(dir, "my-project", "insights", insight.ID+".json")
	if _, err := os.Stat(expectedPath); !os.IsNotExist(err) {
		t.Error("insight file should not exist after deletion")
	}
}
