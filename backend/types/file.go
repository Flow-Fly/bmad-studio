package types

// FileEntry represents a file in the project's _bmad-output directory.
type FileEntry struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Size int64  `json:"size"`
}
