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

// StreamWatcherHook is the interface for notifying the watcher service about stream lifecycle events
type StreamWatcherHook interface {
	AddStreamWatch(projectName, streamName string)
	RemoveStreamWatch(projectName, streamName string)
}

// PhaseDeriver is the interface for deriving and updating stream phase from filesystem state
type PhaseDeriver interface {
	DeriveAndUpdatePhase(projectName, streamName string) (string, error)
}

// StreamService manages stream lifecycle operations
type StreamService struct {
	streamStore     *storage.StreamStore
	registryStore   *storage.RegistryStore
	hub             Broadcaster
	watcherHook     StreamWatcherHook
	phaseDeriver    PhaseDeriver
	worktreeService *WorktreeService
}

// NewStreamService creates a new StreamService
func NewStreamService(streamStore *storage.StreamStore, registryStore *storage.RegistryStore, hub Broadcaster) *StreamService {
	return &StreamService{
		streamStore:   streamStore,
		registryStore: registryStore,
		hub:           hub,
	}
}

// SetWatcherHook sets the watcher hook for stream lifecycle notifications.
// Called after WatcherService is initialized.
func (s *StreamService) SetWatcherHook(hook StreamWatcherHook) {
	s.watcherHook = hook
}

// SetPhaseDeriver sets the phase deriver for on-demand phase derivation.
// Called after WatcherService is initialized.
func (s *StreamService) SetPhaseDeriver(deriver PhaseDeriver) {
	s.phaseDeriver = deriver
}

// SetWorktreeService sets the worktree service for archive-time cleanup.
// Called after WorktreeService is constructed.
func (s *StreamService) SetWorktreeService(wt *WorktreeService) {
	s.worktreeService = wt
}

// streamNameRegex validates stream names: alphanumeric, hyphens, underscores; must start with alphanumeric
var streamNameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]*$`)

// verifyProjectExists checks the registry and returns an error if the project is not registered.
func (s *StreamService) verifyProjectExists(projectName string) error {
	entry, found := s.registryStore.FindByName(projectName)
	if !found || entry == nil {
		return fmt.Errorf("project not found: %s", projectName)
	}
	return nil
}

// Create creates a new stream for a project
func (s *StreamService) Create(projectName, streamName string) (*types.StreamMeta, error) {
	// Validate stream name
	if streamName == "" {
		return nil, fmt.Errorf("invalid stream name: cannot be empty")
	}
	if !streamNameRegex.MatchString(streamName) {
		return nil, fmt.Errorf("invalid stream name: must contain only alphanumeric characters, hyphens, and underscores, and must start with an alphanumeric character")
	}

	if err := s.verifyProjectExists(projectName); err != nil {
		return nil, err
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

	// Notify watcher to add watch for the new stream
	if s.watcherHook != nil {
		s.watcherHook.AddStreamWatch(projectName, streamName)
	}

	return &meta, nil
}

// List returns all streams for a project, sorted by UpdatedAt descending
func (s *StreamService) List(projectName string) ([]*types.StreamMeta, error) {
	if err := s.verifyProjectExists(projectName); err != nil {
		return nil, err
	}

	// Delegate to StreamStore
	streams, err := s.streamStore.ListProjectStreams(projectName)
	if err != nil {
		return nil, fmt.Errorf("failed to list streams for project %s: %w", projectName, err)
	}

	// Derive fresh phase for each active stream
	if s.phaseDeriver != nil {
		for _, stream := range streams {
			if stream.Status == types.StreamStatusActive {
				if phase, err := s.phaseDeriver.DeriveAndUpdatePhase(projectName, stream.Name); err == nil {
					stream.Phase = phase
				}
			}
		}
	}

	return streams, nil
}

// Get returns a specific stream's metadata
func (s *StreamService) Get(projectName, streamName string) (*types.StreamMeta, error) {
	if err := s.verifyProjectExists(projectName); err != nil {
		return nil, err
	}

	// Delegate to StreamStore
	meta, err := s.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}

	// Derive fresh phase from filesystem for active streams
	if s.phaseDeriver != nil && meta.Status == types.StreamStatusActive {
		if phase, err := s.phaseDeriver.DeriveAndUpdatePhase(projectName, streamName); err == nil {
			meta.Phase = phase
		}
	}

	return meta, nil
}

// Archive archives a stream with the given outcome ("merged" or "abandoned").
// If the stream has a worktree and force is false, unmerged changes will cause an error.
// If force is true, the worktree is removed regardless of merge status.
func (s *StreamService) Archive(projectName, streamName, outcome string, force bool) (*types.StreamMeta, error) {
	if outcome != string(types.StreamOutcomeMerged) && outcome != string(types.StreamOutcomeAbandoned) {
		return nil, fmt.Errorf("invalid outcome: must be 'merged' or 'abandoned', got '%s'", outcome)
	}

	if err := s.verifyProjectExists(projectName); err != nil {
		return nil, err
	}

	// Verify stream exists and is active
	meta, err := s.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}

	if meta.Status == types.StreamStatusArchived {
		return nil, fmt.Errorf("stream already archived: %s-%s", projectName, streamName)
	}

	// Worktree cleanup before archiving
	if meta.Worktree != "" && s.worktreeService != nil {
		status, checkErr := s.worktreeService.CheckMergeStatus(projectName, streamName)
		if checkErr != nil {
			// If merge status check fails, proceed only if force=true
			if !force {
				return nil, fmt.Errorf("failed to check worktree merge status: %w", checkErr)
			}
		}

		if (status != nil && status.Merged) || force {
			// Branch is merged or force=true — remove worktree
			if removeErr := s.worktreeService.Remove(projectName, streamName, force); removeErr != nil {
				return nil, fmt.Errorf("failed to cleanup worktree: %w", removeErr)
			}
		} else {
			// Branch has unmerged changes and force=false
			return nil, fmt.Errorf("stream has unmerged changes in worktree: %s. Use force=true to delete anyway", meta.Branch)
		}
	}

	// Archive the stream
	streamOutcome := types.StreamOutcome(outcome)
	if err := s.streamStore.ArchiveStream(projectName, streamName, streamOutcome); err != nil {
		return nil, fmt.Errorf("failed to archive stream: %w", err)
	}

	// Notify watcher to remove watch for the archived stream (before broadcast)
	if s.watcherHook != nil {
		s.watcherHook.RemoveStreamWatch(projectName, streamName)
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

// UpdateMetadata updates stream metadata fields
func (s *StreamService) UpdateMetadata(projectName, streamName string, updates map[string]interface{}) (*types.StreamMeta, error) {
	if err := s.verifyProjectExists(projectName); err != nil {
		return nil, err
	}

	// Read existing metadata
	meta, err := s.streamStore.ReadStreamMeta(projectName, streamName)
	if err != nil {
		return nil, fmt.Errorf("stream not found: %s-%s", projectName, streamName)
	}

	// Apply updates (only allow updating specific fields)
	if branch, ok := updates["branch"].(string); ok {
		meta.Branch = branch
	}
	if worktree, ok := updates["worktree"].(string); ok {
		meta.Worktree = worktree
	}
	if phase, ok := updates["phase"].(string); ok {
		meta.Phase = phase
	}

	// Update timestamp
	meta.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Write back atomically
	if err := s.streamStore.WriteStreamMeta(projectName, streamName, *meta); err != nil {
		return nil, fmt.Errorf("failed to update stream metadata: %w", err)
	}

	// Broadcast stream:updated event
	streamID := projectName + "-" + streamName
	event := types.NewStreamUpdatedEvent(projectName, streamID, updates)
	s.hub.BroadcastEvent(event)

	return meta, nil
}
