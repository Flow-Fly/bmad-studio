package types

// AgentFrontmatter represents the YAML frontmatter of an agent markdown file
type AgentFrontmatter struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description"`
}

// AgentXML represents the parsed XML <agent> element from an agent file
type AgentXML struct {
	ID    string `xml:"id,attr"`
	Name  string `xml:"name,attr"`
	Title string `xml:"title,attr"`
	Icon  string `xml:"icon,attr"`
}

// PersonaXML represents the parsed XML <persona> element
type PersonaXML struct {
	Role               string `xml:"role"`
	Identity           string `xml:"identity"`
	CommunicationStyle string `xml:"communication_style"`
}

// MenuItemXML represents a single menu item from the XML
type MenuItemXML struct {
	Cmd      string `xml:"cmd,attr"`
	Workflow string `xml:"workflow,attr"`
	Exec     string `xml:"exec,attr"`
	Content  string `xml:",chardata"`
}

// Agent represents the combined parsed agent data from frontmatter and XML
type Agent struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Title           string      `json:"title"`
	Icon            string      `json:"icon"`
	FrontmatterName string      `json:"frontmatter_name"`
	Description     string      `json:"description"`
	Persona         Persona     `json:"persona"`
	MenuItems       []MenuItem  `json:"menu_items"`
	Workflows       []string    `json:"workflows"`
}

// Persona represents the persona section from the agent XML
type Persona struct {
	Role               string `json:"role"`
	Identity           string `json:"identity"`
	CommunicationStyle string `json:"communication_style"`
}

// MenuItem represents a single menu item with resolved paths
type MenuItem struct {
	Cmd      string  `json:"cmd"`
	Label    string  `json:"label"`
	Workflow *string `json:"workflow"`
	Exec     *string `json:"exec"`
}

// AgentResponse is the API response type for a single agent
type AgentResponse struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Title           string          `json:"title"`
	Icon            string          `json:"icon"`
	FrontmatterName string          `json:"frontmatter_name"`
	Description     string          `json:"description"`
	Persona         PersonaResponse `json:"persona"`
	MenuItems       []MenuItem      `json:"menu_items"`
	Workflows       []string        `json:"workflows"`
}

// PersonaResponse is the API response type for persona data
type PersonaResponse struct {
	Role               string `json:"role"`
	Identity           string `json:"identity"`
	CommunicationStyle string `json:"communication_style"`
}

// AgentsResponse is the API response wrapper for list of agents
type AgentsResponse struct {
	Agents []AgentResponse `json:"agents"`
}
