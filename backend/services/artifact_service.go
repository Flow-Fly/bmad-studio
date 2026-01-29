package services

import (
	"bytes"
	"encoding/json"
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

// ArtifactServiceError represents a structured error from the artifact service
type ArtifactServiceError struct {
	Code    string
	Message string
}

func (e *ArtifactServiceError) Error() string {
	return e.Message
}

// Error codes for artifact service
const (
	ErrCodeArtifactConfigNotLoaded  = "config_not_loaded"
	ErrCodeArtifactsNotLoaded       = "artifacts_not_loaded"
	ErrCodeArtifactNotFound         = "artifact_not_found"
	ErrCodeRegistryLoadFailed       = "registry_load_failed"
	ErrCodeRegistrySaveFailed       = "registry_save_failed"
)

// Story filename pattern: digit-digit-name.md (e.g., 0-1-parse-config.md)
var storyFilenameRegex = regexp.MustCompile(`^\d+-\d+-.+\.md$`)

// Markdown heading regex to extract first H1
var h1Regex = regexp.MustCompile(`(?m)^#\s+(.+)$`)

// toTitleCase capitalizes the first letter of each word (replaces deprecated strings.Title)
func toTitleCase(s string) string {
	words := strings.Fields(s)
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(word[:1]) + strings.ToLower(word[1:])
		}
	}
	return strings.Join(words, " ")
}

// ArtifactService manages loading and accessing artifact registry
type ArtifactService struct {
	mu                    sync.RWMutex
	configService         *BMadConfigService
	workflowStatusService *WorkflowStatusService
	artifacts             map[string]*types.Artifact
}

// NewArtifactService creates a new ArtifactService instance
func NewArtifactService(configService *BMadConfigService, workflowStatusService *WorkflowStatusService) *ArtifactService {
	return &ArtifactService{
		configService:         configService,
		workflowStatusService: workflowStatusService,
		artifacts:             make(map[string]*types.Artifact),
	}
}

// LoadArtifacts scans the output folder and indexes all artifacts
func (s *ArtifactService) LoadArtifacts() error {
	config := s.configService.GetConfig()
	if config == nil {
		return &ArtifactServiceError{
			Code:    ErrCodeArtifactConfigNotLoaded,
			Message: "BMadConfigService has no config loaded (can't determine output folder)",
		}
	}

	outputFolder := config.OutputFolder
	projectRoot := config.ProjectRoot

	// Check if output folder exists
	if _, err := os.Stat(outputFolder); os.IsNotExist(err) {
		// No output folder yet - return empty artifacts
		s.mu.Lock()
		s.artifacts = make(map[string]*types.Artifact)
		s.mu.Unlock()
		return nil
	}

	artifacts := make(map[string]*types.Artifact)

	err := filepath.Walk(outputFolder, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("Warning: Error accessing %s: %v", path, err)
			return nil // Continue walking
		}

		// Skip status files
		if strings.HasSuffix(info.Name(), "status.yaml") {
			return nil
		}

		// Skip the registry file itself
		if info.Name() == "artifact-registry.json" {
			return nil
		}

		// Handle directories - check for sharded artifacts
		if info.IsDir() {
			indexPath := filepath.Join(path, "index.md")
			if _, err := os.Stat(indexPath); err == nil {
				// This is a sharded artifact directory
				shardedArtifacts, err := s.processShardedArtifact(path, projectRoot)
				if err != nil {
					log.Printf("Warning: Failed to process sharded artifact %s: %v", path, err)
					return nil
				}
				// Add parent and all children to artifacts map
				for _, artifact := range shardedArtifacts {
					artifacts[artifact.ID] = artifact
				}
				return filepath.SkipDir // Don't recurse into sharded directories
			}
			return nil // Continue into other directories
		}

		// Process .md files
		if strings.HasSuffix(info.Name(), ".md") {
			artifact, err := s.processArtifact(path, projectRoot)
			if err != nil {
				log.Printf("Warning: Failed to process artifact %s: %v", path, err)
				return nil
			}
			if artifact != nil {
				artifacts[artifact.ID] = artifact
			}
		}

		return nil
	})

	if err != nil {
		return &ArtifactServiceError{
			Code:    ErrCodeArtifactsNotLoaded,
			Message: fmt.Sprintf("Failed to walk output folder: %v", err),
		}
	}

	// Cross-reference with workflow status
	s.crossReferenceWithWorkflowStatus(artifacts)

	// Atomic update
	s.mu.Lock()
	s.artifacts = artifacts
	s.mu.Unlock()

	// Save registry
	if err := s.SaveRegistry(); err != nil {
		log.Printf("Warning: Failed to save artifact registry: %v", err)
	}

	return nil
}

// processArtifact processes a single markdown file
func (s *ArtifactService) processArtifact(path, projectRoot string) (*types.Artifact, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// Parse frontmatter (may be nil)
	frontmatter, _ := s.parseFrontmatter(content)

	// Calculate relative path
	relativePath, err := filepath.Rel(projectRoot, path)
	if err != nil {
		relativePath = path
	}
	relativePath = filepath.ToSlash(relativePath) // Normalize to forward slashes

	// Classify artifact
	artifactType := s.classifyArtifact(relativePath, frontmatter)

	// Extract name
	name := s.extractName(relativePath, frontmatter, content)

	// Generate ID
	id := s.generateArtifactID(relativePath)

	// Get phase info
	phase, phaseName := s.getPhaseInfo(artifactType)

	// Normalize steps completed
	var stepsCompleted []string
	if frontmatter != nil {
		stepsCompleted = s.normalizeStepsCompleted(frontmatter.StepsCompleted)
	}

	// Determine status
	status := s.determineStatus(frontmatter, content)

	// Build artifact
	artifact := &types.Artifact{
		ID:           id,
		Name:         name,
		Type:         artifactType,
		Path:         relativePath,
		AbsolutePath: path,
		Status:       status,
		Phase:        phase,
		PhaseName:    phaseName,
		ModifiedAt:   info.ModTime().Unix(),
		FileSize:     info.Size(),
		IsSharded:    false,
	}

	// Copy optional fields
	if frontmatter != nil {
		if frontmatter.CompletedAt != "" {
			artifact.CompletedAt = &frontmatter.CompletedAt
		}
		artifact.StepsCompleted = stepsCompleted
		artifact.InputDocuments = frontmatter.InputDocuments
	}

	return artifact, nil
}

// processShardedArtifact processes a sharded artifact directory
// Returns all artifacts: parent (index.md) + all children with ParentID set
func (s *ArtifactService) processShardedArtifact(dirPath, projectRoot string) ([]*types.Artifact, error) {
	indexPath := filepath.Join(dirPath, "index.md")

	// Process index.md as primary (parent)
	parent, err := s.processArtifact(indexPath, projectRoot)
	if err != nil {
		return nil, err
	}

	parent.IsSharded = true

	// Find and process child files
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	var results []*types.Artifact
	results = append(results, parent)

	var childIDs []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		if entry.Name() == "index.md" {
			continue
		}

		// Process child as full artifact
		childPath := filepath.Join(dirPath, entry.Name())
		child, err := s.processArtifact(childPath, projectRoot)
		if err != nil {
			log.Printf("Warning: Failed to process sharded child %s: %v", childPath, err)
			continue
		}

		// Set parent-child relationship
		child.ParentID = &parent.ID
		childIDs = append(childIDs, child.ID)
		results = append(results, child)
	}

	sort.Strings(childIDs)
	parent.Children = childIDs

	return results, nil
}

// parseFrontmatter extracts YAML frontmatter from markdown content.
// Handles both LF and CRLF line endings.
func (s *ArtifactService) parseFrontmatter(content []byte) (*types.ArtifactFrontmatter, error) {
	if len(content) < 3 || !bytes.HasPrefix(content, []byte("---")) {
		return nil, nil
	}

	// Find end of the opening "---" line
	firstNewline := bytes.IndexByte(content[3:], '\n')
	if firstNewline == -1 {
		return nil, nil
	}
	startIdx := 3 + firstNewline + 1 // skip past "---\n"

	// Find closing "---" on its own line
	rest := content[startIdx:]
	endIdx := bytes.Index(rest, []byte("\n---"))
	if endIdx == -1 {
		return nil, nil
	}

	var fm types.ArtifactFrontmatter
	if err := yaml.Unmarshal(rest[:endIdx], &fm); err != nil {
		return nil, err
	}

	return &fm, nil
}

// normalizeStepsCompleted converts various formats to []string
func (s *ArtifactService) normalizeStepsCompleted(raw interface{}) []string {
	if raw == nil {
		return nil
	}

	switch v := raw.(type) {
	case []interface{}:
		result := make([]string, 0, len(v))
		for _, item := range v {
			switch i := item.(type) {
			case string:
				result = append(result, i)
			case int:
				result = append(result, fmt.Sprintf("step-%d", i))
			case float64:
				result = append(result, fmt.Sprintf("step-%d", int(i)))
			}
		}
		return result
	case []string:
		return v
	case []int:
		result := make([]string, 0, len(v))
		for _, i := range v {
			result = append(result, fmt.Sprintf("step-%d", i))
		}
		return result
	}

	return nil
}

// extractName extracts a human-readable name for the artifact
func (s *ArtifactService) extractName(path string, fm *types.ArtifactFrontmatter, content []byte) string {
	// Try frontmatter.ProjectName first
	if fm != nil && fm.ProjectName != "" {
		return fm.ProjectName
	}

	// Try first H1 heading
	matches := h1Regex.FindSubmatch(content)
	if len(matches) > 1 {
		return strings.TrimSpace(string(matches[1]))
	}

	// Fallback to filename without extension, title-cased
	filename := filepath.Base(path)
	name := strings.TrimSuffix(filename, filepath.Ext(filename))
	name = strings.ReplaceAll(name, "-", " ")
	name = strings.ReplaceAll(name, "_", " ")
	return toTitleCase(name)
}

// generateArtifactID generates a unique ID from the relative path
func (s *ArtifactService) generateArtifactID(relativePath string) string {
	// Strip .md extension
	id := strings.TrimSuffix(relativePath, ".md")
	// Replace path separators with hyphens
	id = strings.ReplaceAll(id, "/", "-")
	id = strings.ReplaceAll(id, "\\", "-")
	// Lowercase
	id = strings.ToLower(id)
	return id
}

// classifyArtifact determines the artifact type using multi-layer strategy
func (s *ArtifactService) classifyArtifact(path string, fm *types.ArtifactFrontmatter) string {
	// Priority 1: Frontmatter workflowType
	if fm != nil && fm.WorkflowType != "" {
		return s.classifyByFrontmatter(fm)
	}

	// Priority 2: Filename patterns
	return s.classifyByFilename(path)
}

// classifyByFrontmatter maps workflowType to artifact type
func (s *ArtifactService) classifyByFrontmatter(fm *types.ArtifactFrontmatter) string {
	switch strings.ToLower(fm.WorkflowType) {
	case "prd":
		return types.ArtifactTypePRD
	case "architecture", "create-architecture":
		return types.ArtifactTypeArchitecture
	case "create-epics-and-stories", "epics":
		return types.ArtifactTypeEpics
	case "create-story", "dev-story":
		return types.ArtifactTypeStories
	case "create-ux-design", "ux-design":
		return types.ArtifactTypeUXDesign
	case "research":
		return types.ArtifactTypeResearch
	case "brainstorming":
		return types.ArtifactTypeBrainstorming
	case "create-product-brief", "product-brief":
		return types.ArtifactTypeProductBrief
	case "validate", "validation", "check-implementation-readiness":
		return types.ArtifactTypeValidationReport
	case "generate-project-context", "project-context":
		return types.ArtifactTypeProjectContext
	default:
		return types.ArtifactTypeOther
	}
}

// classifyByFilename determines artifact type from filename patterns
func (s *ArtifactService) classifyByFilename(path string) string {
	filename := strings.ToLower(filepath.Base(path))
	dir := strings.ToLower(filepath.Dir(path))

	// Product brief (check before prd)
	if strings.Contains(filename, "product-brief") {
		return types.ArtifactTypeProductBrief
	}

	// Validation report (check before prd)
	if strings.Contains(filename, "validation") {
		return types.ArtifactTypeValidationReport
	}

	// PRD
	if strings.Contains(filename, "prd") {
		return types.ArtifactTypePRD
	}

	// Architecture
	if strings.Contains(filename, "architecture") {
		return types.ArtifactTypeArchitecture
	}

	// Epics
	if strings.Contains(filename, "epic") && !storyFilenameRegex.MatchString(filename) {
		return types.ArtifactTypeEpics
	}

	// Stories (digit-digit-name.md pattern)
	if storyFilenameRegex.MatchString(filename) {
		return types.ArtifactTypeStories
	}

	// UX Design
	if strings.Contains(filename, "ux") || strings.HasPrefix(dir, "ux-") || strings.Contains(dir, "/ux-") {
		return types.ArtifactTypeUXDesign
	}

	// Research
	if strings.Contains(dir, "research") {
		return types.ArtifactTypeResearch
	}

	// Brainstorming
	if strings.Contains(dir, "brainstorming") {
		return types.ArtifactTypeBrainstorming
	}

	// Project context
	if filename == "project-context.md" {
		return types.ArtifactTypeProjectContext
	}

	return types.ArtifactTypeOther
}

// getPhaseInfo returns the BMAD phase number and name for an artifact type
func (s *ArtifactService) getPhaseInfo(artifactType string) (int, string) {
	switch artifactType {
	case types.ArtifactTypeResearch, types.ArtifactTypeBrainstorming, types.ArtifactTypeProductBrief:
		return 1, "Analysis"
	case types.ArtifactTypePRD, types.ArtifactTypeUXDesign:
		return 2, "Planning"
	case types.ArtifactTypeArchitecture, types.ArtifactTypeEpics, types.ArtifactTypeValidationReport:
		return 3, "Solutioning"
	case types.ArtifactTypeStories:
		return 4, "Implementation"
	default:
		return 0, "Meta"
	}
}

// determineStatus determines artifact status from frontmatter or content
func (s *ArtifactService) determineStatus(fm *types.ArtifactFrontmatter, content []byte) string {
	// Check frontmatter status
	if fm != nil && fm.Status != "" {
		status := strings.ToLower(fm.Status)
		switch status {
		case "complete", "completed", "done":
			return types.ArtifactStatusComplete
		case "in-progress", "in_progress", "inprogress":
			return types.ArtifactStatusInProgress
		}
	}

	// Check content for status line (stories often have "Status: xxx")
	contentStr := string(content)
	if strings.Contains(contentStr, "Status: done") || strings.Contains(contentStr, "Status: complete") {
		return types.ArtifactStatusComplete
	}
	if strings.Contains(contentStr, "Status: in-progress") || strings.Contains(contentStr, "Status: review") {
		return types.ArtifactStatusInProgress
	}
	if strings.Contains(contentStr, "Status: ready-for-dev") || strings.Contains(contentStr, "Status: backlog") {
		return types.ArtifactStatusNotStarted
	}

	return types.ArtifactStatusNotStarted
}

// crossReferenceWithWorkflowStatus sets WorkflowID based on workflow status
func (s *ArtifactService) crossReferenceWithWorkflowStatus(artifacts map[string]*types.Artifact) {
	if s.workflowStatusService == nil {
		return
	}

	status, err := s.workflowStatusService.GetStatus()
	if err != nil || status == nil {
		return
	}

	for workflowID, wfStatus := range status.WorkflowStatuses {
		if !wfStatus.IsComplete || wfStatus.ArtifactPath == nil {
			continue
		}

		// Normalize path: strip _bmad-output/ prefix
		artifactPath := strings.TrimPrefix(*wfStatus.ArtifactPath, "_bmad-output/")

		// Find matching artifact by path
		for _, artifact := range artifacts {
			if strings.HasSuffix(artifact.Path, artifactPath) {
				wfID := workflowID
				artifact.WorkflowID = &wfID
				break
			}
		}
	}
}

// GetArtifacts returns all artifacts as API responses
func (s *ArtifactService) GetArtifacts() ([]types.ArtifactResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Collect IDs and sort for deterministic output
	ids := make([]string, 0, len(s.artifacts))
	for id := range s.artifacts {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	// Build response in sorted order
	responses := make([]types.ArtifactResponse, 0, len(s.artifacts))
	for _, id := range ids {
		responses = append(responses, s.toResponse(s.artifacts[id]))
	}

	return responses, nil
}

// GetArtifact returns a single artifact by ID
func (s *ArtifactService) GetArtifact(id string) (*types.ArtifactResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	artifact, ok := s.artifacts[id]
	if !ok {
		return nil, &ArtifactServiceError{
			Code:    ErrCodeArtifactNotFound,
			Message: fmt.Sprintf("Artifact not found: %s", id),
		}
	}

	resp := s.toResponse(artifact)
	return &resp, nil
}

// toResponse converts internal Artifact to API response
func (s *ArtifactService) toResponse(artifact *types.Artifact) types.ArtifactResponse {
	return types.ArtifactResponse{
		ID:             artifact.ID,
		Name:           artifact.Name,
		Type:           artifact.Type,
		Path:           artifact.Path,
		Status:         artifact.Status,
		CompletedAt:    artifact.CompletedAt,
		Phase:          artifact.Phase,
		PhaseName:      artifact.PhaseName,
		WorkflowID:     artifact.WorkflowID,
		StepsCompleted: artifact.StepsCompleted,
		InputDocuments: artifact.InputDocuments,
		IsSharded:      artifact.IsSharded,
		Children:       artifact.Children,
		ParentID:       artifact.ParentID,
		ModifiedAt:     artifact.ModifiedAt,
		FileSize:       artifact.FileSize,
	}
}

// getRegistryPath returns the path to the artifact registry file
func (s *ArtifactService) getRegistryPath() (string, error) {
	config := s.configService.GetConfig()
	if config == nil {
		return "", &ArtifactServiceError{
			Code:    ErrCodeArtifactConfigNotLoaded,
			Message: "BMadConfigService has no config loaded",
		}
	}
	return filepath.Join(config.OutputFolder, "artifact-registry.json"), nil
}

// SaveRegistry persists the artifact registry to disk
func (s *ArtifactService) SaveRegistry() error {
	registryPath, err := s.getRegistryPath()
	if err != nil {
		return err
	}

	responses, err := s.GetArtifacts()
	if err != nil {
		return err
	}

	wrapper := types.ArtifactsResponse{Artifacts: responses}
	data, err := json.MarshalIndent(wrapper, "", "  ")
	if err != nil {
		return &ArtifactServiceError{
			Code:    ErrCodeRegistrySaveFailed,
			Message: fmt.Sprintf("Failed to marshal registry: %v", err),
		}
	}

	// Ensure directory exists
	dir := filepath.Dir(registryPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return &ArtifactServiceError{
			Code:    ErrCodeRegistrySaveFailed,
			Message: fmt.Sprintf("Failed to create registry directory: %v", err),
		}
	}

	// Write atomically via temp file
	tempPath := registryPath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return &ArtifactServiceError{
			Code:    ErrCodeRegistrySaveFailed,
			Message: fmt.Sprintf("Failed to write temp registry file: %v", err),
		}
	}

	if err := os.Rename(tempPath, registryPath); err != nil {
		os.Remove(tempPath) // Clean up temp file
		return &ArtifactServiceError{
			Code:    ErrCodeRegistrySaveFailed,
			Message: fmt.Sprintf("Failed to rename registry file: %v", err),
		}
	}

	return nil
}

// ProcessSingleArtifact processes a single artifact file and adds/updates it in the registry
// Returns the artifact response for broadcasting
func (s *ArtifactService) ProcessSingleArtifact(path string) (*types.ArtifactResponse, error) {
	config := s.configService.GetConfig()
	if config == nil {
		return nil, &ArtifactServiceError{
			Code:    ErrCodeArtifactConfigNotLoaded,
			Message: "BMadConfigService has no config loaded",
		}
	}

	// Process the artifact
	artifact, err := s.processArtifact(path, config.ProjectRoot)
	if err != nil {
		return nil, err
	}
	if artifact == nil {
		return nil, nil
	}

	// Update registry
	s.mu.Lock()
	s.artifacts[artifact.ID] = artifact
	s.mu.Unlock()

	// Save registry
	if err := s.SaveRegistry(); err != nil {
		log.Printf("Warning: Failed to save artifact registry: %v", err)
	}

	resp := s.toResponse(artifact)
	return &resp, nil
}

// idFromAbsPath converts an absolute file path to an artifact ID.
// Returns the ID and an error if the config is not loaded.
func (s *ArtifactService) idFromAbsPath(path string) (string, error) {
	config := s.configService.GetConfig()
	if config == nil {
		return "", &ArtifactServiceError{
			Code:    ErrCodeArtifactConfigNotLoaded,
			Message: "BMadConfigService has no config loaded",
		}
	}

	relativePath, err := filepath.Rel(config.ProjectRoot, path)
	if err != nil {
		relativePath = path
	}
	relativePath = filepath.ToSlash(relativePath)

	return s.generateArtifactID(relativePath), nil
}

// RemoveArtifact removes an artifact from the registry by path
// Returns the removed artifact response for broadcasting
func (s *ArtifactService) RemoveArtifact(path string) (*types.ArtifactResponse, error) {
	id, err := s.idFromAbsPath(path)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	artifact, exists := s.artifacts[id]
	if exists {
		delete(s.artifacts, id)
	}
	s.mu.Unlock()

	if !exists {
		return nil, nil
	}

	if err := s.SaveRegistry(); err != nil {
		log.Printf("Warning: Failed to save artifact registry: %v", err)
	}

	resp := s.toResponse(artifact)
	return &resp, nil
}

// GetArtifactByPath returns an artifact by its absolute path
func (s *ArtifactService) GetArtifactByPath(path string) (*types.ArtifactResponse, error) {
	id, err := s.idFromAbsPath(path)
	if err != nil {
		return nil, err
	}

	return s.GetArtifact(id)
}

// LoadRegistry loads the artifact registry from disk (for cache validation)
func (s *ArtifactService) LoadRegistry() error {
	registryPath, err := s.getRegistryPath()
	if err != nil {
		return err
	}

	data, err := os.ReadFile(registryPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // No registry yet - not an error
		}
		return &ArtifactServiceError{
			Code:    ErrCodeRegistryLoadFailed,
			Message: fmt.Sprintf("Failed to read registry file: %v", err),
		}
	}

	var wrapper types.ArtifactsResponse
	if err := json.Unmarshal(data, &wrapper); err != nil {
		return &ArtifactServiceError{
			Code:    ErrCodeRegistryLoadFailed,
			Message: fmt.Sprintf("Failed to parse registry file: %v", err),
		}
	}

	// Convert responses to internal artifacts and validate
	config := s.configService.GetConfig()
	if config == nil {
		return nil
	}

	artifacts := make(map[string]*types.Artifact)
	for _, resp := range wrapper.Artifacts {
		// Construct and validate path
		absPath := filepath.Clean(filepath.Join(config.ProjectRoot, resp.Path))

		// Security: Ensure path doesn't escape project root (path traversal protection)
		if !strings.HasPrefix(absPath, filepath.Clean(config.ProjectRoot)+string(filepath.Separator)) &&
			absPath != filepath.Clean(config.ProjectRoot) {
			log.Printf("Warning: Skipping artifact with path outside project root: %s", resp.Path)
			continue
		}

		// Validate file still exists
		info, err := os.Stat(absPath)
		if err != nil {
			// File no longer exists - skip
			continue
		}

		// Check if modified since registry was written
		if info.ModTime().Unix() != resp.ModifiedAt {
			// File changed - will be rescanned
			continue
		}

		artifact := &types.Artifact{
			ID:             resp.ID,
			Name:           resp.Name,
			Type:           resp.Type,
			Path:           resp.Path,
			AbsolutePath:   absPath,
			Status:         resp.Status,
			CompletedAt:    resp.CompletedAt,
			Phase:          resp.Phase,
			PhaseName:      resp.PhaseName,
			WorkflowID:     resp.WorkflowID,
			StepsCompleted: resp.StepsCompleted,
			InputDocuments: resp.InputDocuments,
			IsSharded:      resp.IsSharded,
			Children:       resp.Children,
			ParentID:       resp.ParentID,
			ModifiedAt:     resp.ModifiedAt,
			FileSize:       resp.FileSize,
		}
		artifacts[artifact.ID] = artifact
	}

	s.mu.Lock()
	s.artifacts = artifacts
	s.mu.Unlock()

	return nil
}

