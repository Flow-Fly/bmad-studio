package types

// WorktreeResult is returned after a successful worktree creation
type WorktreeResult struct {
	WorktreePath string `json:"worktreePath"`
	Branch       string `json:"branch"`
}
