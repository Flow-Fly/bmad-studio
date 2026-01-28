package services

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"

	"bmad-studio/backend/types"

	"gopkg.in/yaml.v3"
)

// AgentServiceError represents a structured error from the agent service
type AgentServiceError struct {
	Code    string
	Message string
}

func (e *AgentServiceError) Error() string {
	return e.Message
}

// Error codes for agent service
const (
	ErrCodeAgentsNotFound       = "agents_not_found"
	ErrCodeInvalidAgentFile     = "invalid_agent_file"
	ErrCodeAgentConfigNotLoaded = "config_not_loaded"
	ErrCodeAgentNotFound        = "agent_not_found"
)

// agentXMLRoot is the internal struct for parsing XML from agent files
type agentXMLRoot struct {
	XMLName xml.Name   `xml:"agent"`
	ID      string     `xml:"id,attr"`
	Name    string     `xml:"name,attr"`
	Title   string     `xml:"title,attr"`
	Icon    string     `xml:"icon,attr"`
	Persona personaXML `xml:"persona"`
	Menu    menuXML    `xml:"menu"`
}

type personaXML struct {
	Role               string `xml:"role"`
	Identity           string `xml:"identity"`
	CommunicationStyle string `xml:"communication_style"`
}

type menuXML struct {
	Items []menuItemXML `xml:"item"`
}

type menuItemXML struct {
	Cmd      string `xml:"cmd,attr"`
	Workflow string `xml:"workflow,attr"`
	Exec     string `xml:"exec,attr"`
	Content  string `xml:",chardata"`
}

// Regex to extract XML from markdown code fence
var xmlCodeFenceRegex = regexp.MustCompile("(?s)```xml\\s*\\n(.*?)```")

// AgentService manages loading and accessing BMAD agent definitions
type AgentService struct {
	mu            sync.RWMutex
	configService *BMadConfigService
	agents        map[string]*types.Agent // Keyed by agent ID
}

// NewAgentService creates a new AgentService instance
func NewAgentService(configService *BMadConfigService) *AgentService {
	return &AgentService{
		configService: configService,
		agents:        make(map[string]*types.Agent),
	}
}

// LoadAgents scans and parses all agent markdown files
func (s *AgentService) LoadAgents() error {
	config := s.configService.GetConfig()
	if config == nil {
		return &AgentServiceError{
			Code:    ErrCodeAgentConfigNotLoaded,
			Message: "BMadConfigService has no config loaded (can't determine project root)",
		}
	}

	projectRoot := config.ProjectRoot
	agentsDir := filepath.Join(projectRoot, "_bmad", "bmm", "agents")

	// Check if directory exists
	if _, err := os.Stat(agentsDir); errors.Is(err, os.ErrNotExist) {
		return &AgentServiceError{
			Code:    ErrCodeAgentsNotFound,
			Message: fmt.Sprintf("Agents directory not found: %s", agentsDir),
		}
	}

	// Find all markdown files
	agentFiles, err := filepath.Glob(filepath.Join(agentsDir, "*.md"))
	if err != nil {
		return &AgentServiceError{
			Code:    ErrCodeAgentsNotFound,
			Message: fmt.Sprintf("Failed to scan agents directory: %v", err),
		}
	}

	if len(agentFiles) == 0 {
		return &AgentServiceError{
			Code:    ErrCodeAgentsNotFound,
			Message: fmt.Sprintf("No markdown files found in agents directory: %s", agentsDir),
		}
	}

	// Parse all agent files with fault tolerance
	agents := make(map[string]*types.Agent)
	var parseErrors []string

	for _, agentFile := range agentFiles {
		agent, err := s.parseAgentFile(agentFile, projectRoot)
		if err != nil {
			// Log error and continue loading other agents (fault tolerance)
			log.Printf("Warning: Failed to parse agent file %s: %v", filepath.Base(agentFile), err)
			parseErrors = append(parseErrors, filepath.Base(agentFile))
			continue
		}

		// Validate agent ID is not empty
		if agent.ID == "" {
			log.Printf("Warning: Agent file %s has empty ID, skipping", filepath.Base(agentFile))
			parseErrors = append(parseErrors, filepath.Base(agentFile))
			continue
		}

		// Check for duplicate agent IDs
		if existing, exists := agents[agent.ID]; exists {
			log.Printf("Warning: Duplicate agent ID '%s' found in %s (already loaded from another file with name '%s')",
				agent.ID, filepath.Base(agentFile), existing.FrontmatterName)
			parseErrors = append(parseErrors, filepath.Base(agentFile))
			continue
		}

		agents[agent.ID] = agent
	}

	// Only fail if no agents could be loaded at all
	if len(agents) == 0 {
		return &AgentServiceError{
			Code:    ErrCodeAgentsNotFound,
			Message: fmt.Sprintf("No valid agents could be loaded. Files with errors: %v", parseErrors),
		}
	}

	s.mu.Lock()
	s.agents = agents
	s.mu.Unlock()

	if len(parseErrors) > 0 {
		log.Printf("Loaded %d agents successfully, %d files had errors: %v", len(agents), len(parseErrors), parseErrors)
	}

	return nil
}

// parseAgentFile parses a single agent markdown file
func (s *AgentService) parseAgentFile(filePath, projectRoot string) (*types.Agent, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, &AgentServiceError{
			Code:    ErrCodeInvalidAgentFile,
			Message: fmt.Sprintf("Failed to read agent file %s: %v", filepath.Base(filePath), err),
		}
	}

	// Parse frontmatter
	frontmatter, err := s.parseFrontmatter(content)
	if err != nil {
		return nil, &AgentServiceError{
			Code:    ErrCodeInvalidAgentFile,
			Message: fmt.Sprintf("Failed to parse frontmatter in %s: %v", filepath.Base(filePath), err),
		}
	}

	// Parse XML content
	agentXML, err := s.parseXML(content)
	if err != nil {
		return nil, &AgentServiceError{
			Code:    ErrCodeInvalidAgentFile,
			Message: fmt.Sprintf("Failed to parse XML in %s: %v", filepath.Base(filePath), err),
		}
	}

	// Resolve menu paths and collect workflows
	menuItems, workflows := s.resolveMenuPaths(agentXML.Menu.Items, projectRoot)

	agent := &types.Agent{
		ID:              agentXML.ID,
		Name:            agentXML.Name,
		Title:           agentXML.Title,
		Icon:            agentXML.Icon,
		FrontmatterName: frontmatter.Name,
		Description:     frontmatter.Description,
		Persona: types.Persona{
			Role:               strings.TrimSpace(agentXML.Persona.Role),
			Identity:           strings.TrimSpace(agentXML.Persona.Identity),
			CommunicationStyle: strings.TrimSpace(agentXML.Persona.CommunicationStyle),
		},
		MenuItems: menuItems,
		Workflows: workflows,
	}

	return agent, nil
}

// parseFrontmatter extracts YAML frontmatter from markdown content
func (s *AgentService) parseFrontmatter(content []byte) (*types.AgentFrontmatter, error) {
	// Check for frontmatter delimiter (handles both LF and CRLF)
	if !bytes.HasPrefix(content, []byte("---")) {
		return nil, fmt.Errorf("no frontmatter found")
	}

	// Find the first newline after opening delimiter (handles both \n and \r\n)
	firstNewline := bytes.IndexAny(content[3:], "\r\n")
	if firstNewline == -1 {
		return nil, fmt.Errorf("no newline after frontmatter delimiter")
	}

	// Calculate start of frontmatter content (skip --- and newline(s))
	startIdx := 3 + firstNewline
	if startIdx < len(content) && content[startIdx] == '\n' {
		startIdx++ // Skip \n in case of \r\n
	} else if startIdx < len(content) && content[startIdx] == '\r' && startIdx+1 < len(content) && content[startIdx+1] == '\n' {
		startIdx += 2 // Skip \r\n
	} else {
		startIdx++ // Skip single \n
	}

	// Find closing delimiter
	rest := content[startIdx:]
	endIdx := bytes.Index(rest, []byte("\n---"))
	if endIdx == -1 {
		// Also check for CRLF variant
		endIdx = bytes.Index(rest, []byte("\r\n---"))
		if endIdx == -1 {
			return nil, fmt.Errorf("frontmatter not closed")
		}
	}

	frontmatterBytes := rest[:endIdx]
	var fm types.AgentFrontmatter
	if err := yaml.Unmarshal(frontmatterBytes, &fm); err != nil {
		return nil, err
	}

	return &fm, nil
}

// parseXML extracts and parses XML from markdown code fence
func (s *AgentService) parseXML(content []byte) (*agentXMLRoot, error) {
	matches := xmlCodeFenceRegex.FindSubmatch(content)
	if len(matches) < 2 {
		return nil, fmt.Errorf("no XML code fence found")
	}

	xmlContent := matches[1]
	var agentXML agentXMLRoot
	if err := xml.Unmarshal(xmlContent, &agentXML); err != nil {
		return nil, err
	}

	return &agentXML, nil
}

// resolveMenuPaths replaces {project-root} in workflow and exec paths
func (s *AgentService) resolveMenuPaths(items []menuItemXML, projectRoot string) ([]types.MenuItem, []string) {
	menuItems := make([]types.MenuItem, 0, len(items))
	workflowSet := make(map[string]struct{})

	for _, item := range items {
		mi := types.MenuItem{
			Cmd:   item.Cmd,
			Label: strings.TrimSpace(item.Content),
		}

		// Resolve and set workflow path (normalize separators with filepath.Clean)
		if item.Workflow != "" {
			resolved := filepath.Clean(strings.ReplaceAll(item.Workflow, "{project-root}", projectRoot))
			mi.Workflow = &resolved
			workflowSet[resolved] = struct{}{}
		}

		// Resolve and set exec path (normalize separators with filepath.Clean)
		if item.Exec != "" {
			resolved := filepath.Clean(strings.ReplaceAll(item.Exec, "{project-root}", projectRoot))
			mi.Exec = &resolved
			workflowSet[resolved] = struct{}{}
		}

		menuItems = append(menuItems, mi)
	}

	// Convert workflow set to slice and sort for deterministic output
	workflows := make([]string, 0, len(workflowSet))
	for wf := range workflowSet {
		workflows = append(workflows, wf)
	}
	sort.Strings(workflows)

	return menuItems, workflows
}

// GetAgents returns all parsed agents as API responses
func (s *AgentService) GetAgents() ([]types.AgentResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if len(s.agents) == 0 {
		return nil, &AgentServiceError{
			Code:    ErrCodeAgentsNotFound,
			Message: "No agents loaded. Call LoadAgents() first.",
		}
	}

	// Collect agent IDs and sort for deterministic output
	ids := make([]string, 0, len(s.agents))
	for id := range s.agents {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	// Build response in sorted order
	responses := make([]types.AgentResponse, 0, len(s.agents))
	for _, id := range ids {
		responses = append(responses, s.toResponse(s.agents[id]))
	}

	return responses, nil
}

// GetAgent returns a single agent by ID
func (s *AgentService) GetAgent(id string) (*types.AgentResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	agent, ok := s.agents[id]
	if !ok {
		return nil, &AgentServiceError{
			Code:    ErrCodeAgentNotFound,
			Message: fmt.Sprintf("Agent not found: %s", id),
		}
	}

	resp := s.toResponse(agent)
	return &resp, nil
}

// toResponse converts internal Agent to API response
func (s *AgentService) toResponse(agent *types.Agent) types.AgentResponse {
	return types.AgentResponse{
		ID:              agent.ID,
		Name:            agent.Name,
		Title:           agent.Title,
		Icon:            agent.Icon,
		FrontmatterName: agent.FrontmatterName,
		Description:     agent.Description,
		Persona: types.PersonaResponse{
			Role:               agent.Persona.Role,
			Identity:           agent.Persona.Identity,
			CommunicationStyle: agent.Persona.CommunicationStyle,
		},
		MenuItems: agent.MenuItems,
		Workflows: agent.Workflows,
	}
}
