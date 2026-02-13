package types

// WorktreeResult is returned after a successful worktree creation
type WorktreeResult struct {
	WorktreePath string `json:"worktreePath"`
	Branch       string `json:"branch"`
}

// WorktreeStatus describes the merge status of a worktree's branch
type WorktreeStatus struct {
	Merged       bool   `json:"merged"`
	Branch       string `json:"branch"`
	WorktreePath string `json:"worktreePath"`
}
