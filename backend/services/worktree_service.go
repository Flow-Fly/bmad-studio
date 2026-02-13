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

// resolveRepoPath looks up a project's repository path from the registry.
func (w *WorktreeService) resolveRepoPath(projectName string) (string, error) {
	entry, found := w.registryStore.FindByName(projectName)
	if !found || entry == nil {
		return "", fmt.Errorf("project not found: %s", projectName)
	}
	return entry.RepoPath, nil
}

// Create creates a git worktree for a stream.
// It derives the worktree path and branch name from the stream name,
// runs `git worktree add`, and updates stream.json with the worktree info.
func (w *WorktreeService) Create(projectName, streamName string) (*types.WorktreeResult, error) {
	if err := w.GitAvailable(); err != nil {
		return nil, err
	}

	repoPath, err := w.resolveRepoPath(projectName)
	if err != nil {
		return nil, err
	}

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

	repoParent := filepath.Dir(repoPath)
	worktreePath := filepath.Join(repoParent, "bmad-wt-"+streamName)
	branchName := "stream/" + streamName

	if _, err := os.Stat(worktreePath); err == nil {
		return nil, fmt.Errorf("worktree path already exists: %s", worktreePath)
	}

	cmd := exec.Command("git", "-C", repoPath, "worktree", "add", worktreePath, "-b", branchName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		outputStr := strings.TrimSpace(string(output))
		if strings.Contains(outputStr, "already exists") {
			return nil, fmt.Errorf("branch already exists: %s", branchName)
		}
		return nil, fmt.Errorf("git worktree add failed: %s", outputStr)
	}

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

// Remove removes a git worktree and its branch for a stream.
// If force is false and the worktree has uncommitted changes, it returns an error.
// If the worktree directory was already deleted, it prunes stale refs.
func (w *WorktreeService) Remove(projectName, streamName string, force bool) error {
	if err := w.GitAvailable(); err != nil {
		return err
	}

	repoPath, err := w.resolveRepoPath(projectName)
	if err != nil {
		return err
	}

	meta, err := w.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}
	if meta.Worktree == "" {
		return fmt.Errorf("no worktree for stream: %s-%s", projectName, streamName)
	}

	worktreePath := meta.Worktree
	branchName := meta.Branch

	if _, statErr := os.Stat(worktreePath); os.IsNotExist(statErr) {
		// Directory already deleted — prune stale worktree references
		cmd := exec.Command("git", "-C", repoPath, "worktree", "prune")
		if output, pruneErr := cmd.CombinedOutput(); pruneErr != nil {
			return fmt.Errorf("git worktree prune failed: %s", strings.TrimSpace(string(output)))
		}
	} else {
		// Directory exists — remove the worktree via git
		args := []string{"-C", repoPath, "worktree", "remove"}
		if force {
			args = append(args, "--force")
		}
		args = append(args, worktreePath)
		cmd := exec.Command("git", args...)
		output, removeErr := cmd.CombinedOutput()
		if removeErr != nil {
			outputStr := strings.TrimSpace(string(output))
			if !force && (strings.Contains(outputStr, "modified") || strings.Contains(outputStr, "untracked") || strings.Contains(outputStr, "changes")) {
				return fmt.Errorf("unmerged changes: worktree has uncommitted changes, use force to override")
			}
			return fmt.Errorf("git worktree remove failed: %s", outputStr)
		}
	}

	if branchName != "" {
		deleteFlag := "-d"
		if force {
			deleteFlag = "-D"
		}
		cmd := exec.Command("git", "-C", repoPath, "branch", deleteFlag, branchName)
		output, branchErr := cmd.CombinedOutput()
		if branchErr != nil {
			outputStr := strings.TrimSpace(string(output))
			// If branch doesn't exist, that's OK — it may have been deleted already
			if !strings.Contains(outputStr, "not found") {
				return fmt.Errorf("git branch delete failed: %s", outputStr)
			}
		}
	}

	meta.Worktree = ""
	meta.Branch = ""
	meta.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := w.streamStore.WriteStreamMeta(projectName, streamName, *meta); err != nil {
		return fmt.Errorf("failed to update stream metadata: %w", err)
	}

	return nil
}

// CheckMergeStatus checks whether a stream's worktree branch has been merged
// into the current HEAD of the project's repository.
func (w *WorktreeService) CheckMergeStatus(projectName, streamName string) (*types.WorktreeStatus, error) {
	repoPath, err := w.resolveRepoPath(projectName)
	if err != nil {
		return nil, err
	}

	meta, err := w.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}
	if meta.Branch == "" {
		return nil, fmt.Errorf("no worktree for stream: %s-%s", projectName, streamName)
	}

	branchName := meta.Branch

	cmd := exec.Command("git", "-C", repoPath, "branch", "--merged")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("git branch --merged failed: %s", strings.TrimSpace(string(output)))
	}

	// Parse output: each line is a branch name (trimmed)
	// Prefixes: "* " for current branch, "+ " for checked-out-in-worktree
	merged := false
	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		line = strings.TrimPrefix(line, "* ")
		line = strings.TrimPrefix(line, "+ ")
		if line == branchName {
			merged = true
			break
		}
	}

	return &types.WorktreeStatus{
		Merged:       merged,
		Branch:       branchName,
		WorktreePath: meta.Worktree,
	}, nil
}

// Switch returns the worktree path for a stream, validating that both
// the stream metadata and the worktree directory exist.
// This is a read-only operation — it does not run any git commands.
func (w *WorktreeService) Switch(projectName, streamName string) (*types.WorktreeResult, error) {
	meta, err := w.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}

	if meta.Worktree == "" {
		return nil, fmt.Errorf("no worktree exists for this stream: %s-%s", projectName, streamName)
	}

	if _, err := os.Stat(meta.Worktree); os.IsNotExist(err) {
		return nil, fmt.Errorf("worktree path no longer exists: %s — recreate the worktree to continue", meta.Worktree)
	}

	return &types.WorktreeResult{
		WorktreePath: meta.Worktree,
		Branch:       meta.Branch,
	}, nil
}
