package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"bmad-studio/backend/types"
)

// InsightStore handles reading and writing Insight JSON files to disk.
type InsightStore struct {
	mu      sync.Mutex
	baseDir string // base directory, e.g. ~/bmad-studio/projects
}

// NewInsightStore creates an InsightStore using ~/bmad-studio/projects as the base.
func NewInsightStore() (*InsightStore, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	return &InsightStore{
		baseDir: filepath.Join(home, "bmad-studio", "projects"),
	}, nil
}

// NewInsightStoreWithPath creates an InsightStore with a custom base directory (used for testing).
func NewInsightStoreWithPath(baseDir string) *InsightStore {
	return &InsightStore{baseDir: baseDir}
}

// SaveInsight writes an Insight as JSON to the project's insights directory.
// The file is written to {baseDir}/{projectName}/insights/{insightID}.json.
func (s *InsightStore) SaveInsight(projectName string, insight types.Insight) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Join(s.baseDir, projectName, "insights")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create insights directory: %w", err)
	}

	data, err := json.MarshalIndent(insight, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal insight: %w", err)
	}

	filePath := filepath.Join(dir, insight.ID+".json")
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("write insight file: %w", err)
	}

	return nil
}
