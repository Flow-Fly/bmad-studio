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
