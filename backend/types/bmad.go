package types

// BMadConfig represents the parsed BMAD configuration from _bmad/bmm/config.yaml
type BMadConfig struct {
	ProjectName            string `json:"project_name" yaml:"project_name"`
	UserSkillLevel         string `json:"user_skill_level" yaml:"user_skill_level"`
	PlanningArtifacts      string `json:"planning_artifacts" yaml:"planning_artifacts"`
	ImplementationArtifacts string `json:"implementation_artifacts" yaml:"implementation_artifacts"`
	ProjectKnowledge       string `json:"project_knowledge" yaml:"project_knowledge"`
	TeaUseMCPEnhancements  bool   `json:"tea_use_mcp_enhancements" yaml:"tea_use_mcp_enhancements"`
	TeaUsePlaywrightUtils  bool   `json:"tea_use_playwright_utils" yaml:"tea_use_playwright_utils"`
	UserName               string `json:"user_name" yaml:"user_name"`
	CommunicationLanguage  string `json:"communication_language" yaml:"communication_language"`
	DocumentOutputLanguage string `json:"document_output_language" yaml:"document_output_language"`
	OutputFolder           string `json:"output_folder" yaml:"output_folder"`
	ProjectRoot            string `json:"project_root" yaml:"-"`
}
