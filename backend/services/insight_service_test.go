package services

import (
	"testing"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

func newTestInsightService(t *testing.T) *InsightService {
	t.Helper()
	dir := t.TempDir()
	store := storage.NewInsightStoreWithPath(dir)
	return NewInsightService(store)
}

func TestCreateInsight_Success(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		ID:          "test-001",
		Title:       "Test Insight",
		Status:      "fresh",
		CreatedAt:   "2026-02-04T10:00:00Z",
		SourceAgent: "Analyst",
	}

	err := svc.CreateInsight("my-project", insight)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestCreateInsight_MissingID(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		Title:  "Test Insight",
		Status: "fresh",
	}

	err := svc.CreateInsight("my-project", insight)
	if err == nil {
		t.Fatal("expected error for missing id")
	}
}

func TestCreateInsight_MissingTitle(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		ID:     "test-001",
		Status: "fresh",
	}

	err := svc.CreateInsight("my-project", insight)
	if err == nil {
		t.Fatal("expected error for missing title")
	}
}

func TestCreateInsight_MissingStatus(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		ID:    "test-001",
		Title: "Test Insight",
	}

	err := svc.CreateInsight("my-project", insight)
	if err == nil {
		t.Fatal("expected error for missing status")
	}
}

func TestListInsights_DelegatesToStore(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		ID:        "test-001",
		Title:     "Test Insight",
		Status:    "fresh",
		CreatedAt: "2026-02-04T10:00:00Z",
	}
	if err := svc.CreateInsight("my-project", insight); err != nil {
		t.Fatalf("create error: %v", err)
	}

	insights, err := svc.ListInsights("my-project")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	if len(insights) != 1 {
		t.Fatalf("expected 1 insight, got %d", len(insights))
	}
	if insights[0].ID != "test-001" {
		t.Errorf("expected id 'test-001', got %q", insights[0].ID)
	}
}

func TestUpdateInsight_ValidatesAndSaves(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		ID:        "test-001",
		Title:     "Original Title",
		Status:    "fresh",
		CreatedAt: "2026-02-04T10:00:00Z",
	}
	if err := svc.CreateInsight("my-project", insight); err != nil {
		t.Fatalf("create error: %v", err)
	}

	insight.Title = "Updated Title"
	err := svc.UpdateInsight("my-project", insight)
	if err != nil {
		t.Fatalf("update error: %v", err)
	}

	loaded, err := svc.GetInsight("my-project", "test-001")
	if err != nil {
		t.Fatalf("get error: %v", err)
	}
	if loaded.Title != "Updated Title" {
		t.Errorf("expected 'Updated Title', got %q", loaded.Title)
	}
}

func TestUpdateInsight_MissingTitle(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		ID:     "test-001",
		Status: "fresh",
	}
	err := svc.UpdateInsight("my-project", insight)
	if err == nil {
		t.Fatal("expected error for missing title")
	}
}

func TestDeleteInsight_DelegatesToStore(t *testing.T) {
	svc := newTestInsightService(t)

	insight := types.Insight{
		ID:        "test-001",
		Title:     "Test Insight",
		Status:    "fresh",
		CreatedAt: "2026-02-04T10:00:00Z",
	}
	if err := svc.CreateInsight("my-project", insight); err != nil {
		t.Fatalf("create error: %v", err)
	}

	err := svc.DeleteInsight("my-project", "test-001")
	if err != nil {
		t.Fatalf("delete error: %v", err)
	}

	insights, err := svc.ListInsights("my-project")
	if err != nil {
		t.Fatalf("list error: %v", err)
	}
	if len(insights) != 0 {
		t.Errorf("expected 0 insights after delete, got %d", len(insights))
	}
}
