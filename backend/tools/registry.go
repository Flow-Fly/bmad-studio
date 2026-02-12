package tools

import (
	"fmt"
	"sync"

	"bmad-studio/backend/types"
)

// safeDefaultTools are tools allowed when ToolScope has empty permissions.
var safeDefaultTools = map[string]bool{
	"file_read":  true,
	"web_search": true,
}

// ToolRegistry holds registered tools and provides discovery by name and scope.
type ToolRegistry struct {
	tools map[string]*Tool
	mu    sync.RWMutex
}

// NewRegistry creates a new empty ToolRegistry.
func NewRegistry() *ToolRegistry {
	return &ToolRegistry{
		tools: make(map[string]*Tool),
	}
}

// RegisterCore registers a built-in tool. Returns error if name is duplicate.
func (r *ToolRegistry) RegisterCore(tool *Tool) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.tools[tool.Name]; exists {
		return fmt.Errorf("tool %q already registered", tool.Name)
	}
	r.tools[tool.Name] = tool
	return nil
}

// RegisterMCP is a scaffold for future MCP tool registration.
func (r *ToolRegistry) RegisterMCP(serverName string) error {
	return fmt.Errorf("MCP tool registration not implemented (server: %s)", serverName)
}

// Get returns a tool by name, or nil if not found.
func (r *ToolRegistry) Get(name string) *Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.tools[name]
}

// ListForScope returns tools permitted by the given ToolScope.
// If scope is nil, returns all tools.
// If scope has empty permissions, returns only safe defaults.
func (r *ToolRegistry) ListForScope(scope *types.ToolScope) []*Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if scope == nil {
		return r.allTools()
	}

	if len(scope.Permissions) == 0 {
		return r.safeDefaults()
	}

	var result []*Tool
	for _, tool := range r.tools {
		if perm, ok := scope.Permissions[tool.Name]; ok && perm.Allowed {
			result = append(result, tool)
		}
	}
	return result
}

// ListDefinitionsForScope returns ToolDefinitions for provider requests.
func (r *ToolRegistry) ListDefinitionsForScope(scope *types.ToolScope) []types.ToolDefinition {
	tools := r.ListForScope(scope)
	defs := make([]types.ToolDefinition, len(tools))
	for i, t := range tools {
		defs[i] = t.ToDefinition()
	}
	return defs
}

// allTools returns all registered tools.
func (r *ToolRegistry) allTools() []*Tool {
	result := make([]*Tool, 0, len(r.tools))
	for _, tool := range r.tools {
		result = append(result, tool)
	}
	return result
}

// safeDefaults returns only safe default tools.
func (r *ToolRegistry) safeDefaults() []*Tool {
	var result []*Tool
	for name, tool := range r.tools {
		if safeDefaultTools[name] {
			result = append(result, tool)
		}
	}
	return result
}
