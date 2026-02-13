package services

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupWorktreeTest creates a test environment with a real git repo, central store,
// a registered project, and an active stream with no worktree.
func setupWorktreeTest(t *testing.T) (*WorktreeService, *storage.CentralStore, string, string) {
	t.Helper()

	// Skip if git is not installed
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed, skipping worktree tests")
	}

	rootDir := resolveDir(t, t.TempDir())

	// Create central store
	store := storage.NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	streamStore := storage.NewStreamStore(store)
	registryStore := storage.NewRegistryStore(store)

	// Create a real git repo
	repoPath := filepath.Join(rootDir, "my-project-repo")
	err = os.MkdirAll(repoPath, 0755)
	require.NoError(t, err)

	// Initialize git repo with an initial commit (required for worktree add)
	runGit(t, repoPath, "init")
	runGit(t, repoPath, "config", "user.email", "test@test.com")
	runGit(t, repoPath, "config", "user.name", "Test")

	// Create initial commit so HEAD exists
	dummyFile := filepath.Join(repoPath, "README.md")
	err = os.WriteFile(dummyFile, []byte("# Test"), 0644)
	require.NoError(t, err)
	runGit(t, repoPath, "add", ".")
	runGit(t, repoPath, "commit", "-m", "initial commit")

	// Register project
	projectName := "my-project"
	err = registryStore.AddProject(types.RegistryEntry{
		Name:     projectName,
		RepoPath: repoPath,
	})
	require.NoError(t, err)

	// Create an active stream
	streamName := "payment-integration"
	_, err = streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: "2026-02-12T10:00:00Z",
	}
	err = streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	worktreeService := NewWorktreeService(registryStore, streamStore)
	return worktreeService, store, rootDir, repoPath
}

// runGit runs a git command in the given directory and fails on error
func runGit(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	require.NoError(t, err, "git %v failed: %s", args, string(output))
}

func TestWorktreeService_Create_Success(t *testing.T) {
	svc, store, rootDir, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)
	require.NotNil(t, result)

	// Verify result fields
	expectedWorktreePath := filepath.Join(rootDir, "bmad-wt-"+streamName)
	expectedBranch := "stream/" + streamName
	assert.Equal(t, expectedWorktreePath, result.WorktreePath)
	assert.Equal(t, expectedBranch, result.Branch)

	// Verify worktree directory exists on disk
	_, err = os.Stat(result.WorktreePath)
	assert.NoError(t, err, "worktree directory should exist")

	// Verify stream.json was updated
	streamStore := storage.NewStreamStore(store)
	meta, err := streamStore.ReadStreamMeta(projectName, streamName)
	require.NoError(t, err)
	assert.Equal(t, expectedWorktreePath, meta.Worktree)
	assert.Equal(t, expectedBranch, meta.Branch)
}

func TestWorktreeService_Create_ErrorProjectNotFound(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	_, err := svc.Create("nonexistent-project", "some-stream")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "project not found")
}

func TestWorktreeService_Create_ErrorStreamNotFound(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	_, err := svc.Create("my-project", "nonexistent-stream")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "stream not found")
}

func TestWorktreeService_Create_ErrorStreamAlreadyHasWorktree(t *testing.T) {
	svc, store, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// First creation should succeed
	_, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Create a second stream that already has a worktree set
	streamStore := storage.NewStreamStore(store)
	streamName2 := "has-worktree"
	_, err = streamStore.CreateStreamDir(projectName, streamName2)
	require.NoError(t, err)
	meta := types.StreamMeta{
		Name:      streamName2,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		Worktree:  "/some/existing/path",
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: "2026-02-12T10:00:00Z",
	}
	err = streamStore.WriteStreamMeta(projectName, streamName2, meta)
	require.NoError(t, err)

	_, err = svc.Create(projectName, streamName2)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already has worktree")
}

func TestWorktreeService_Create_ErrorBranchAlreadyExists(t *testing.T) {
	svc, store, _, repoPath := setupWorktreeTest(t)

	projectName := "my-project"

	// Create the branch manually first to trigger conflict
	runGit(t, repoPath, "branch", "stream/conflict-stream")

	// Create a stream for it
	streamStore := storage.NewStreamStore(store)
	streamName := "conflict-stream"
	_, err := streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: "2026-02-12T10:00:00Z",
	}
	err = streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	_, err = svc.Create(projectName, streamName)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestWorktreeService_Create_ErrorWorktreePathExists(t *testing.T) {
	svc, store, rootDir, _ := setupWorktreeTest(t)

	projectName := "my-project"

	// Create a second stream
	streamStore := storage.NewStreamStore(store)
	streamName := "path-conflict"
	_, err := streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: "2026-02-12T10:00:00Z",
	}
	err = streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	// Pre-create the worktree path directory on disk
	worktreePath := filepath.Join(rootDir, "bmad-wt-"+streamName)
	err = os.MkdirAll(worktreePath, 0755)
	require.NoError(t, err)

	_, err = svc.Create(projectName, streamName)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "worktree path already exists")
}

func TestWorktreeService_GitAvailable(t *testing.T) {
	// This test verifies that GitAvailable works when git is installed
	// (we skip this entire test file if git is not installed)
	if _, lookErr := exec.LookPath("git"); lookErr != nil {
		t.Skip("git not installed")
	}

	rootDir := resolveDir(t, t.TempDir())
	store := storage.NewCentralStoreWithPath(rootDir)
	err := store.Init()
	require.NoError(t, err)

	svc := NewWorktreeService(
		storage.NewRegistryStore(store),
		storage.NewStreamStore(store),
	)

	err = svc.GitAvailable()
	assert.NoError(t, err)
}

func TestWorktreeService_Create_ErrorStreamNotActive(t *testing.T) {
	svc, store, _, _ := setupWorktreeTest(t)

	projectName := "my-project"

	// Create an archived stream
	streamStore := storage.NewStreamStore(store)
	streamName := "archived-stream"
	_, err := streamStore.CreateStreamDir(projectName, streamName)
	require.NoError(t, err)
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusArchived,
		Type:      types.StreamTypeFull,
		Outcome:   types.StreamOutcomeMerged,
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: "2026-02-12T10:00:00Z",
	}
	err = streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	_, err = svc.Create(projectName, streamName)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not active")
}

// --- Switch tests ---

func TestWorktreeService_Switch_Success(t *testing.T) {
	svc, store, rootDir, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a real worktree directory on disk
	worktreePath := filepath.Join(rootDir, "bmad-wt-"+streamName)
	err := os.MkdirAll(worktreePath, 0755)
	require.NoError(t, err)

	// Write stream metadata with worktree fields
	streamStore := storage.NewStreamStore(store)
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		Worktree:  worktreePath,
		Branch:    "stream/" + streamName,
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: "2026-02-12T10:00:00Z",
	}
	err = streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	result, err := svc.Switch(projectName, streamName)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, worktreePath, result.WorktreePath)
	assert.Equal(t, "stream/"+streamName, result.Branch)
}

func TestWorktreeService_Switch_ErrorNoWorktree(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Stream exists but has no worktree (default from setupWorktreeTest)
	_, err := svc.Switch(projectName, streamName)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no worktree")
}

func TestWorktreeService_Switch_ErrorMissingDirectory(t *testing.T) {
	svc, store, rootDir, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Set worktree metadata pointing to a non-existent path
	nonExistentPath := filepath.Join(rootDir, "bmad-wt-gone")
	streamStore := storage.NewStreamStore(store)
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		Worktree:  nonExistentPath,
		Branch:    "stream/" + streamName,
		CreatedAt: "2026-02-12T10:00:00Z",
		UpdatedAt: "2026-02-12T10:00:00Z",
	}
	err := streamStore.WriteStreamMeta(projectName, streamName, meta)
	require.NoError(t, err)

	_, err = svc.Switch(projectName, streamName)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no longer exists")
}

func TestWorktreeService_Switch_ErrorStreamNotFound(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	_, err := svc.Switch("my-project", "nonexistent-stream")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// --- Remove tests ---

func TestWorktreeService_Remove_Success(t *testing.T) {
	svc, store, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree first
	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Verify worktree directory exists
	_, err = os.Stat(result.WorktreePath)
	require.NoError(t, err)

	// Remove the worktree
	err = svc.Remove(projectName, streamName, false)
	require.NoError(t, err)

	// Verify worktree directory is gone
	_, err = os.Stat(result.WorktreePath)
	assert.True(t, os.IsNotExist(err), "worktree directory should be deleted")

	// Verify stream.json was updated (worktree and branch cleared)
	streamStore := storage.NewStreamStore(store)
	meta, err := streamStore.ReadStreamMeta(projectName, streamName)
	require.NoError(t, err)
	assert.Empty(t, meta.Worktree)
	assert.Empty(t, meta.Branch)
}

func TestWorktreeService_Remove_DirectoryAlreadyDeleted(t *testing.T) {
	svc, store, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree
	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Manually remove the worktree directory (simulating manual deletion)
	err = os.RemoveAll(result.WorktreePath)
	require.NoError(t, err)

	// Remove should succeed (prunes stale refs)
	err = svc.Remove(projectName, streamName, false)
	require.NoError(t, err)

	// Verify stream.json was updated
	streamStore := storage.NewStreamStore(store)
	meta, err := streamStore.ReadStreamMeta(projectName, streamName)
	require.NoError(t, err)
	assert.Empty(t, meta.Worktree)
	assert.Empty(t, meta.Branch)
}

func TestWorktreeService_Remove_DirtyWorktree_NoForce(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree
	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Create an untracked file in the worktree to make it dirty
	dirtyFile := filepath.Join(result.WorktreePath, "dirty.txt")
	err = os.WriteFile(dirtyFile, []byte("uncommitted changes"), 0644)
	require.NoError(t, err)

	// Remove without force should fail
	err = svc.Remove(projectName, streamName, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmerged changes")
}

func TestWorktreeService_Remove_DirtyWorktree_Force(t *testing.T) {
	svc, store, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree
	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Create an untracked file in the worktree to make it dirty
	dirtyFile := filepath.Join(result.WorktreePath, "dirty.txt")
	err = os.WriteFile(dirtyFile, []byte("uncommitted changes"), 0644)
	require.NoError(t, err)

	// Force remove should succeed
	err = svc.Remove(projectName, streamName, true)
	require.NoError(t, err)

	// Verify worktree directory is gone
	_, err = os.Stat(result.WorktreePath)
	assert.True(t, os.IsNotExist(err), "worktree directory should be deleted")

	// Verify stream.json was updated
	streamStore := storage.NewStreamStore(store)
	meta, err := streamStore.ReadStreamMeta(projectName, streamName)
	require.NoError(t, err)
	assert.Empty(t, meta.Worktree)
	assert.Empty(t, meta.Branch)
}

func TestWorktreeService_Remove_NoWorktree(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	// Stream exists but has no worktree (default from setupWorktreeTest)
	err := svc.Remove("my-project", "payment-integration", false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no worktree")
}

// --- CheckMergeStatus tests ---

func TestWorktreeService_CheckMergeStatus_Merged(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree (creates branch stream/payment-integration)
	_, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// The branch was just created from HEAD, so it should be "merged" (same as HEAD)
	status, err := svc.CheckMergeStatus(projectName, streamName)
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.True(t, status.Merged)
	assert.Equal(t, "stream/"+streamName, status.Branch)
}

func TestWorktreeService_CheckMergeStatus_Unmerged(t *testing.T) {
	svc, _, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree
	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Make a commit on the worktree branch (making it diverge from HEAD)
	newFile := filepath.Join(result.WorktreePath, "feature.txt")
	err = os.WriteFile(newFile, []byte("new feature"), 0644)
	require.NoError(t, err)
	runGit(t, result.WorktreePath, "add", ".")
	runGit(t, result.WorktreePath, "commit", "-m", "add feature")

	// Check merge status from the main repo's perspective
	status, err := svc.CheckMergeStatus(projectName, streamName)
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.False(t, status.Merged)
	assert.Equal(t, "stream/"+streamName, status.Branch)
}

// --- Archive integration tests ---

func TestWorktreeService_ArchiveWithMergedWorktree(t *testing.T) {
	svc, store, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree (branch is at same commit as main, so "merged")
	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Set up stream service with worktree integration
	streamStore := storage.NewStreamStore(store)
	registryStore := storage.NewRegistryStore(store)
	hub := &mockHub{events: make([]*types.WebSocketEvent, 0)}
	streamService := NewStreamService(streamStore, registryStore, hub)
	streamService.SetWorktreeService(svc)

	// Archive the stream — worktree is merged, should auto-cleanup
	meta, err := streamService.Archive(projectName, streamName, "merged", false)
	require.NoError(t, err)
	require.NotNil(t, meta)
	assert.Equal(t, types.StreamStatusArchived, meta.Status)

	// Verify worktree directory is gone
	_, err = os.Stat(result.WorktreePath)
	assert.True(t, os.IsNotExist(err), "worktree directory should be deleted after archive")
}

func TestWorktreeService_ArchiveWithUnmergedWorktree_Error(t *testing.T) {
	svc, store, _, _ := setupWorktreeTest(t)

	projectName := "my-project"
	streamName := "payment-integration"

	// Create a worktree
	result, err := svc.Create(projectName, streamName)
	require.NoError(t, err)

	// Make a commit on the worktree branch to make it unmerged
	newFile := filepath.Join(result.WorktreePath, "feature.txt")
	err = os.WriteFile(newFile, []byte("new feature"), 0644)
	require.NoError(t, err)
	runGit(t, result.WorktreePath, "add", ".")
	runGit(t, result.WorktreePath, "commit", "-m", "add feature")

	// Set up stream service with worktree integration
	streamStore := storage.NewStreamStore(store)
	registryStore := storage.NewRegistryStore(store)
	hub := &mockHub{events: make([]*types.WebSocketEvent, 0)}
	streamService := NewStreamService(streamStore, registryStore, hub)
	streamService.SetWorktreeService(svc)

	// Archive should fail — unmerged changes
	_, err = streamService.Archive(projectName, streamName, "merged", false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unmerged changes")

	// Verify worktree directory still exists
	_, err = os.Stat(result.WorktreePath)
	assert.NoError(t, err, "worktree should still exist when archive fails")
}
