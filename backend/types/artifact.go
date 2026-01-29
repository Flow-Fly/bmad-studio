package types

// Artifact type constants for classification
const (
	ArtifactTypePRD              = "prd"
	ArtifactTypeArchitecture     = "architecture"
	ArtifactTypeEpics            = "epics"
	ArtifactTypeStories          = "stories"
	ArtifactTypeUXDesign         = "ux_design"
	ArtifactTypeResearch         = "research"
	ArtifactTypeBrainstorming    = "brainstorming"
	ArtifactTypeProductBrief     = "product_brief"
	ArtifactTypeValidationReport = "validation_report"
	ArtifactTypeProjectContext   = "project_context"
	ArtifactTypeOther            = "other"
)

// Artifact status constants
const (
	ArtifactStatusComplete   = "complete"
	ArtifactStatusInProgress = "in-progress"
	ArtifactStatusNotStarted = "not-started"
)

// ArtifactFrontmatter represents YAML frontmatter in artifact markdown files
type ArtifactFrontmatter struct {
	Status         string      `yaml:"status"`
	StepsCompleted interface{} `yaml:"stepsCompleted"` // []string OR []int
	CompletedAt    string      `yaml:"completedAt"`
	InputDocuments []string    `yaml:"inputDocuments"`
	WorkflowType   string      `yaml:"workflowType"`
	ProjectName    string      `yaml:"project_name"` // For title extraction
}

// Artifact represents an internal artifact record
type Artifact struct {
	ID             string
	Name           string   // Human-readable title
	Type           string   // ArtifactType constant
	Path           string   // Relative path from project root
	AbsolutePath   string   // Full path on disk
	Status         string   // complete, in-progress, not-started
	CompletedAt    *string  // Completion date if available
	Phase          int      // BMAD phase number
	PhaseName      string   // BMAD phase name
	WorkflowID     *string  // Which workflow produced it
	StepsCompleted []string // Normalized to strings
	InputDocuments []string // Source documents
	IsSharded      bool     // Whether this is a sharded artifact
	Children       []string // Child artifact IDs for sharded artifacts
	ParentID       *string  // Parent artifact ID for child shards
	ModifiedAt     int64    // Unix timestamp for cache validation
	FileSize       int64    // File size in bytes
}

// ArtifactResponse is the API response format for a single artifact
type ArtifactResponse struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Type           string   `json:"type"`
	Path           string   `json:"path"`
	Status         string   `json:"status"`
	CompletedAt    *string  `json:"completed_at"`
	Phase          int      `json:"phase"`
	PhaseName      string   `json:"phase_name"`
	WorkflowID     *string  `json:"workflow_id"`
	StepsCompleted []string `json:"steps_completed"`
	InputDocuments []string `json:"input_documents"`
	IsSharded      bool     `json:"is_sharded"`
	Children       []string `json:"children"`
	ParentID       *string  `json:"parent_id"`
	ModifiedAt     int64    `json:"modified_at"`
	FileSize       int64    `json:"file_size"`
}

// ArtifactsResponse is the API response wrapper for listing artifacts
type ArtifactsResponse struct {
	Artifacts []ArtifactResponse `json:"artifacts"`
}
