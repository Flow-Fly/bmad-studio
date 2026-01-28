package types

// WorkflowStatus represents the parsed bmm-workflow-status.yaml file
type WorkflowStatus struct {
	Track string `json:"track" yaml:"track"`
}
