package types

// PathDefinition represents a parsed BMAD workflow path definition file (e.g., method-greenfield.yaml)
type PathDefinition struct {
	MethodName  string  `json:"method_name" yaml:"method_name"`
	Track       string  `json:"track" yaml:"track"`
	FieldType   string  `json:"field_type" yaml:"field_type"`
	Description string  `json:"description" yaml:"description"`
	Phases      []Phase `json:"phases" yaml:"phases"`
}

// Phase represents a workflow phase within a path definition
type Phase struct {
	PhaseNum  int        `json:"phase" yaml:"phase"`
	Name      string     `json:"name" yaml:"name"`
	Required  bool       `json:"required" yaml:"required"`
	Optional  bool       `json:"optional" yaml:"optional"`
	Note      string     `json:"note,omitempty" yaml:"note,omitempty"`
	Workflows []Workflow `json:"workflows" yaml:"workflows"`
}

// Workflow represents a single workflow within a phase
type Workflow struct {
	ID                  string   `json:"id" yaml:"id"`
	Exec                string   `json:"exec,omitempty" yaml:"exec,omitempty"`
	WorkflowRef         string   `json:"workflow,omitempty" yaml:"workflow,omitempty"`
	Required            bool     `json:"required" yaml:"required"`
	Optional            bool     `json:"optional" yaml:"optional"`
	Conditional         string   `json:"conditional,omitempty" yaml:"conditional,omitempty"`
	Agent               string   `json:"agent,omitempty" yaml:"agent,omitempty"`
	Command             string   `json:"command,omitempty" yaml:"command,omitempty"`
	Output              string   `json:"output,omitempty" yaml:"output,omitempty"`
	Note                string   `json:"note,omitempty" yaml:"note,omitempty"`
	IncludedBy          string   `json:"included_by,omitempty" yaml:"included_by,omitempty"`
	Purpose             string   `json:"purpose,omitempty" yaml:"purpose,omitempty"`
	CompletionArtifacts []string `json:"completion_artifacts,omitempty" yaml:"completion_artifacts,omitempty"`
}

// PhaseResponse is the API response format for phases
type PhaseResponse struct {
	PhaseNum  int                `json:"phase"`
	Name      string             `json:"name"`
	Required  bool               `json:"required"`
	Optional  bool               `json:"optional"`
	Note      *string            `json:"note"`
	Workflows []WorkflowResponse `json:"workflows"`
}

// WorkflowResponse is the API response format for workflows
type WorkflowResponse struct {
	ID            string  `json:"id"`
	Exec          *string `json:"exec"`
	Required      bool    `json:"required"`
	Optional      bool    `json:"optional"`
	Conditional   *string `json:"conditional"`
	ConditionType *string `json:"condition_type"`
	Agent         *string `json:"agent"`
	Command       *string `json:"command"`
	Output        *string `json:"output"`
	Note          *string `json:"note"`
	IncludedBy    *string `json:"included_by"`
	Purpose       *string `json:"purpose"`
}

// PhasesResponse is the full API response for GET /api/v1/bmad/phases
type PhasesResponse struct {
	MethodName  string          `json:"method_name"`
	Track       string          `json:"track"`
	FieldType   string          `json:"field_type"`
	Description string          `json:"description"`
	Phases      []PhaseResponse `json:"phases"`
}
