package services

import (
	"fmt"
	"regexp"
	"time"

	"bmad-studio/backend/storage"
	"bmad-studio/backend/types"
)

// Broadcaster is the interface for broadcasting WebSocket events
type Broadcaster interface {
	BroadcastEvent(event *types.WebSocketEvent)
}

// StreamService manages stream lifecycle operations
type StreamService struct {
	streamStore   *storage.StreamStore
	registryStore *storage.RegistryStore
	hub           Broadcaster
}

// NewStreamService creates a new StreamService
func NewStreamService(streamStore *storage.StreamStore, registryStore *storage.RegistryStore, hub Broadcaster) *StreamService {
	return &StreamService{
		streamStore:   streamStore,
		registryStore: registryStore,
		hub:           hub,
	}
}

// streamNameRegex validates stream names: alphanumeric, hyphens, underscores; must start with alphanumeric
var streamNameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`)

// Create creates a new stream for a project
func (s *StreamService) Create(projectName, streamName string) (*types.StreamMeta, error) {
	// Validate stream name
	if streamName == "" {
		return nil, fmt.Errorf("invalid stream name: cannot be empty")
	}
	if !streamNameRegex.MatchString(streamName) {
		return nil, fmt.Errorf("invalid stream name: must contain only alphanumeric characters, hyphens, and underscores, and must start with an alphanumeric character")
	}

	// Verify project exists in registry
	entry, found := s.registryStore.FindByName(projectName)
	if !found || entry == nil {
		return nil, fmt.Errorf("project not found: %s", projectName)
	}

	// Check for duplicate stream
	if s.streamStore.StreamDirExists(projectName, streamName) {
		return nil, fmt.Errorf("stream already exists: %s-%s", projectName, streamName)
	}

	// Create stream directory
	_, err := s.streamStore.CreateStreamDir(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("failed to create stream directory: %w", err)
	}

	// Build StreamMeta
	now := time.Now().UTC().Format(time.RFC3339)
	meta := types.StreamMeta{
		Name:      streamName,
		Project:   projectName,
		Status:    types.StreamStatusActive,
		Type:      types.StreamTypeFull,
		Phase:     "", // null in JSON via omitempty
		Branch:    "", // null in JSON via omitempty
		Worktree:  "", // null in JSON via omitempty
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Write stream.json
	if err := s.streamStore.WriteStreamMeta(projectName, streamName, meta); err != nil {
		return nil, fmt.Errorf("failed to write stream metadata: %w", err)
	}

	// Broadcast stream:created event
	streamID := projectName + "-" + streamName
	event := types.NewStreamCreatedEvent(projectName, streamID, streamName)
	s.hub.BroadcastEvent(event)

	return &meta, nil
}

// List returns all streams for a project, sorted by UpdatedAt descending
func (s *StreamService) List(projectName string) ([]*types.StreamMeta, error) {
	// Verify project exists in registry
	entry, found := s.registryStore.FindByName(projectName)
	if !found || entry == nil {
		return nil, fmt.Errorf("project not found: %s", projectName)
	}

	// Delegate to StreamStore
	streams, err := s.streamStore.ListProjectStreams(projectName)
	if err != nil {
		return nil, fmt.Errorf("failed to list streams for project %s: %w", projectName, err)
	}

	return streams, nil
}

// Get returns a specific stream's metadata
func (s *StreamService) Get(projectName, streamName string) (*types.StreamMeta, error) {
	// Verify project exists in registry
	entry, found := s.registryStore.FindByName(projectName)
	if !found || entry == nil {
		return nil, fmt.Errorf("project not found: %s", projectName)
	}

	// Delegate to StreamStore
	meta, err := s.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("failed to read stream metadata: %w", err)
	}

	return meta, nil
}

// Archive archives a stream with the given outcome ("merged" or "abandoned")
func (s *StreamService) Archive(projectName, streamName, outcome string) (*types.StreamMeta, error) {
	// Validate outcome
	if outcome != string(types.StreamOutcomeMerged) && outcome != string(types.StreamOutcomeAbandoned) {
		return nil, fmt.Errorf("invalid outcome: must be 'merged' or 'abandoned', got '%s'", outcome)
	}

	// Verify project exists in registry
	entry, found := s.registryStore.FindByName(projectName)
	if !found || entry == nil {
		return nil, fmt.Errorf("project not found: %s", projectName)
	}

	// Verify stream exists and is active
	meta, err := s.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}

	if meta.Status == types.StreamStatusArchived {
		return nil, fmt.Errorf("stream already archived: %s-%s", projectName, streamName)
	}

	// Archive the stream
	streamOutcome := types.StreamOutcome(outcome)
	if err := s.streamStore.ArchiveStream(projectName, streamName, streamOutcome); err != nil {
		return nil, fmt.Errorf("failed to archive stream: %w", err)
	}

	// Broadcast stream:archived event
	streamID := projectName + "-" + streamName
	event := types.NewStreamArchivedEvent(projectName, streamID, outcome)
	s.hub.BroadcastEvent(event)

	// Read and return archived metadata from new location
	archivedMeta, err := s.streamStore.ReadArchivedStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("failed to read archived stream metadata: %w", err)
	}

	return archivedMeta, nil
}
