package types

// NewRegistry creates a new Registry with an initialized Projects slice
func NewRegistry() Registry {
	return Registry{Projects: []RegistryEntry{}}
}
