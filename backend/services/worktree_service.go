package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

// WorktreeService manages git worktree operations for streams
type WorktreeService struct {
	registryStore *storage.RegistryStore
	streamStore   *storage.StreamStore
}

// NewWorktreeService creates a new WorktreeService
func NewWorktreeService(registryStore *storage.RegistryStore, streamStore *storage.StreamStore) *WorktreeService {
	return &WorktreeService{
		registryStore: registryStore,
		streamStore:   streamStore,
	}
}

// GitAvailable checks if git is installed and accessible on PATH
func (w *WorktreeService) GitAvailable() error {
	_, err := exec.LookPath("git")
	if err != nil {
		return fmt.Errorf("git not available: git is required for worktree features")
	}
	return nil
}

// Create creates a git worktree for a stream.
// It derives the worktree path and branch name from the stream name,
// runs `git worktree add`, and updates stream.json with the worktree info.
func (w *WorktreeService) Create(projectName, streamName string) (*types.WorktreeResult, error) {
	// Check git is available
	if err := w.GitAvailable(); err != nil {
		return nil, err
	}

	// Look up project repoPath from registry
	entry, found := w.registryStore.FindByName(projectName)
	if !found || entry == nil {
		return nil, fmt.Errorf("project not found: %s", projectName)
	}
	repoPath := entry.RepoPath

	// Verify stream exists and is active with no existing worktree
	meta, err := w.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}
	if meta.Status != types.StreamStatusActive {
		return nil, fmt.Errorf("stream not active: %s-%s", projectName, streamName)
	}
	if meta.Worktree != "" {
		return nil, fmt.Errorf("stream already has worktree: %s-%s", projectName, streamName)
	}

	// Derive worktree path and branch name
	repoParent := filepath.Dir(repoPath)
	worktreePath := filepath.Join(repoParent, "bmad-wt-"+streamName)
	branchName := "stream/" + streamName

	// Check if worktree path already exists on disk
	if _, err := os.Stat(worktreePath); err == nil {
		return nil, fmt.Errorf("worktree path already exists: %s", worktreePath)
	}

	// Run git worktree add
	cmd := exec.Command("git", "-C", repoPath, "worktree", "add", worktreePath, "-b", branchName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		outputStr := strings.TrimSpace(string(output))
		// Check for branch-already-exists error
		if strings.Contains(outputStr, "already exists") {
			return nil, fmt.Errorf("branch already exists: %s", branchName)
		}
		return nil, fmt.Errorf("git worktree add failed: %s", outputStr)
	}

	// Update stream.json with worktree and branch fields
	meta.Worktree = worktreePath
	meta.Branch = branchName
	meta.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := w.streamStore.WriteStreamMeta(projectName, streamName, *meta); err != nil {
		return nil, fmt.Errorf("failed to update stream metadata: %w", err)
	}

	return &types.WorktreeResult{
		WorktreePath: worktreePath,
		Branch:       branchName,
	}, nil
}

// Switch returns the worktree path for a stream, validating that both
// the stream metadata and the worktree directory exist.
// This is a read-only operation — it does not run any git commands.
func (w *WorktreeService) Switch(projectName, streamName string) (*types.WorktreeResult, error) {
	// Read stream metadata
	meta, err := w.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}

	// Check if stream has a worktree
	if meta.Worktree == "" {
		return nil, fmt.Errorf("no worktree exists for this stream: %s-%s", projectName, streamName)
	}

	// Validate worktree directory still exists on disk
	if _, err := os.Stat(meta.Worktree); os.IsNotExist(err) {
		return nil, fmt.Errorf("worktree path no longer exists: %s — recreate the worktree to continue", meta.Worktree)
	}

	return &types.WorktreeResult{
		WorktreePath: meta.Worktree,
		Branch:       meta.Branch,
	}, nil
}
