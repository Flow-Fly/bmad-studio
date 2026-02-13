package types

import "time"

// StreamArtifactInfo represents an artifact entry within a stream directory.
// Used by the stream artifact listing API.
type StreamArtifactInfo struct {
	Filename   string    `json:"filename"`
	Phase      string    `json:"phase"`
	Type       string    `json:"type"` // "file" or "directory"
	ModifiedAt time.Time `json:"modifiedAt"`
	Size       int64     `json:"size"`
}
