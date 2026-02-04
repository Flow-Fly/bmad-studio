package services

import (
	"fmt"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

// InsightService provides business logic for Insight operations.
type InsightService struct {
	store *storage.InsightStore
}

// NewInsightService creates a new InsightService with the given store.
func NewInsightService(store *storage.InsightStore) *InsightService {
	return &InsightService{store: store}
}

// CreateInsight validates and persists an Insight for the given project.
func (s *InsightService) CreateInsight(projectName string, insight types.Insight) error {
	if insight.ID == "" {
		return fmt.Errorf("insight id is required")
	}
	if insight.Title == "" {
		return fmt.Errorf("insight title is required")
	}
	if insight.Status == "" {
		return fmt.Errorf("insight status is required")
	}
	return s.store.SaveInsight(projectName, insight)
}

// ListInsights returns all Insights for a project, sorted by most recent first.
func (s *InsightService) ListInsights(projectName string) ([]types.Insight, error) {
	return s.store.ListInsights(projectName)
}

// GetInsight returns a single Insight by ID.
func (s *InsightService) GetInsight(projectName, insightID string) (types.Insight, error) {
	if insightID == "" {
		return types.Insight{}, fmt.Errorf("insight id is required")
	}
	return s.store.GetInsight(projectName, insightID)
}

// UpdateInsight validates and persists an updated Insight.
func (s *InsightService) UpdateInsight(projectName string, insight types.Insight) error {
	if insight.ID == "" {
		return fmt.Errorf("insight id is required")
	}
	if insight.Title == "" {
		return fmt.Errorf("insight title is required")
	}
	if insight.Status == "" {
		return fmt.Errorf("insight status is required")
	}
	return s.store.SaveInsight(projectName, insight)
}

// DeleteInsight removes an Insight by ID.
func (s *InsightService) DeleteInsight(projectName, insightID string) error {
	if insightID == "" {
		return fmt.Errorf("insight id is required")
	}
	return s.store.DeleteInsight(projectName, insightID)
}
