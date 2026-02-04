package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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

// ListInsights reads all Insight JSON files from the project's insights directory.
// Returns insights sorted by CreatedAt descending (most recent first).
// Returns an empty slice if the directory does not exist.
func (s *InsightStore) ListInsights(projectName string) ([]types.Insight, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir := filepath.Join(s.baseDir, projectName, "insights")
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []types.Insight{}, nil
		}
		return nil, fmt.Errorf("read insights directory: %w", err)
	}

	var insights []types.Insight
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue // skip unreadable files
		}
		var insight types.Insight
		if err := json.Unmarshal(data, &insight); err != nil {
			continue // skip corrupt files
		}
		insights = append(insights, insight)
	}

	sort.Slice(insights, func(i, j int) bool {
		return insights[i].CreatedAt > insights[j].CreatedAt
	})

	return insights, nil
}

// GetInsight reads a single Insight JSON file by ID.
func (s *InsightStore) GetInsight(projectName, insightID string) (types.Insight, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	filePath := filepath.Join(s.baseDir, projectName, "insights", insightID+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return types.Insight{}, fmt.Errorf("read insight: %w", err)
	}

	var insight types.Insight
	if err := json.Unmarshal(data, &insight); err != nil {
		return types.Insight{}, fmt.Errorf("parse insight: %w", err)
	}

	return insight, nil
}

// DeleteInsight removes an Insight JSON file by ID.
func (s *InsightStore) DeleteInsight(projectName, insightID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filePath := filepath.Join(s.baseDir, projectName, "insights", insightID+".json")
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("delete insight: %w", err)
	}

	return nil
}
