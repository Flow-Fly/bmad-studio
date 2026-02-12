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

// StreamMeta represents the metadata for a stream
type StreamMeta struct {
	Name      string       `json:"name"`
	Project   string       `json:"project"`
	Status    StreamStatus `json:"status"`
	Type      StreamType   `json:"type"`
	Phase     string       `json:"phase,omitempty"`
	Branch    string       `json:"branch,omitempty"`
	Worktree  string       `json:"worktree,omitempty"`
	CreatedAt string       `json:"createdAt"`
	UpdatedAt string       `json:"updatedAt"`
}
