package types

// StreamStatus represents the lifecycle state of a stream
type StreamStatus string

const (
	StreamStatusActive   StreamStatus = "active"
	StreamStatusArchived StreamStatus = "archived"
)

// StreamType represents the type of stream
type StreamType string

const (
	StreamTypeFull StreamType = "full"
)

// StreamOutcome represents the outcome when a stream is archived
type StreamOutcome string

const (
	StreamOutcomeMerged    StreamOutcome = "merged"
	StreamOutcomeAbandoned StreamOutcome = "abandoned"
)

// StreamMeta represents the metadata for a stream
type StreamMeta struct {
	Name      string         `json:"name"`
	Project   string         `json:"project"`
	Status    StreamStatus   `json:"status"`
	Type      StreamType     `json:"type"`
	Phase     string         `json:"phase,omitempty"`
	Branch    string         `json:"branch,omitempty"`
	Worktree  string         `json:"worktree,omitempty"`
	Outcome   StreamOutcome  `json:"outcome,omitempty"`
	CreatedAt string         `json:"createdAt"`
	UpdatedAt string         `json:"updatedAt"`
}
