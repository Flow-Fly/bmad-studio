export interface AgentPersona {
  role: string;
  identity: string;
  communication_style: string;
}

export interface AgentMenuItem {
  cmd: string;
  label: string;
  workflow: string | null;
  exec: string | null;
}

export interface Agent {
  id: string;
  name: string;
  title: string;
  icon: string;
  frontmatter_name: string;
  description: string;
  persona: AgentPersona;
  menu_items: AgentMenuItem[];
  workflows: string[];
}

export interface AgentsResponse {
  agents: Agent[];
}
