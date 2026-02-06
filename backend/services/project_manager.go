package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"bmad-studio/backend/api/websocket"
)

// ProjectManager manages the lifecycle of BMAD services for a project.
// It supports dynamic project switching by stopping existing services
// and re-initializing them for a new project root.
type ProjectManager struct {
	mu sync.RWMutex

	hub *websocket.Hub

	projectRoot string
	projectName string

	configService         *BMadConfigService
	workflowPathService   *WorkflowPathService
	agentService          *AgentService
	workflowStatusService *WorkflowStatusService
	artifactService       *ArtifactService
	fileWatcherService    *FileWatcherService

	// OnProjectLoaded is called after a project is successfully loaded.
	// Use this to initialize dependent services like the tool execution layer.
	OnProjectLoaded func(projectRoot, projectName string)
}

// ServiceStatus reports the availability of each BMAD service.
type ServiceStatus struct {
	Config    bool `json:"config"`
	Phases    bool `json:"phases"`
	Agents    bool `json:"agents"`
	Status    bool `json:"status"`
	Artifacts bool `json:"artifacts"`
	Watcher   bool `json:"watcher"`
}

// ProjectInfo contains the result of opening a project.
type ProjectInfo struct {
	ProjectName string        `json:"project_name"`
	ProjectRoot string        `json:"project_root"`
	BmadLoaded  bool          `json:"bmad_loaded"`
	Services    ServiceStatus `json:"services"`
}

// NewProjectManager creates a new ProjectManager with the given WebSocket hub.
func NewProjectManager(hub *websocket.Hub) *ProjectManager {
	return &ProjectManager{
		hub: hub,
	}
}

// LoadProject initializes all BMAD services for the given project path.
// It validates the new project fully before stopping existing services,
// ensuring a failed switch preserves the current project (atomic switch pattern).
func (pm *ProjectManager) LoadProject(projectRoot string) (*ProjectInfo, error) {
	// Phase 1: Sanitize and validate path (no lock needed)
	absPath, err := filepath.Abs(projectRoot)
	if err != nil {
		return nil, &ProjectError{
			Code:    "path_invalid",
			Message: fmt.Sprintf("Invalid path: %v", err),
		}
	}
	projectRoot = absPath

	info, err := os.Stat(projectRoot)
	if err != nil {
		return nil, &ProjectError{
			Code:    "path_not_found",
			Message: fmt.Sprintf("Path does not exist: %s", projectRoot),
		}
	}
	if !info.IsDir() {
		return nil, &ProjectError{
			Code:    "path_not_directory",
			Message: fmt.Sprintf("Path is not a directory: %s", projectRoot),
		}
	}

	bmadPath := filepath.Join(projectRoot, "_bmad")
	if _, err := os.Stat(bmadPath); os.IsNotExist(err) {
		return nil, &ProjectError{
			Code:    "bmad_not_found",
			Message: "No BMAD configuration found in the selected folder. Ensure the project has _bmad/bmm/config.yaml or run npx bmad-method install.",
		}
	}

	// Phase 2: Initialize all new services before stopping old ones
	configService := NewBMadConfigService()
	if err := configService.LoadConfig(projectRoot); err != nil {
		return nil, &ProjectError{
			Code:    "bmad_config_invalid",
			Message: fmt.Sprintf("Failed to parse BMAD configuration: %v", err),
		}
	}

	if configService.GetConfig() == nil {
		return nil, &ProjectError{
			Code:    "bmad_config_invalid",
			Message: "BMAD configuration loaded but is empty or invalid.",
		}
	}

	projectName := filepath.Base(projectRoot)
	status := ServiceStatus{Config: true}

	var workflowPathService *WorkflowPathService
	wps := NewWorkflowPathService(configService)
	if err := wps.LoadPaths(); err != nil {
		log.Printf("Warning: Failed to load workflow paths: %v", err)
	} else {
		workflowPathService = wps
		status.Phases = true
	}

	var agentService *AgentService
	as := NewAgentService(configService)
	if err := as.LoadAgents(); err != nil {
		log.Printf("Warning: Failed to load agents: %v", err)
	} else {
		agentService = as
		status.Agents = true
	}

	var workflowStatusService *WorkflowStatusService
	if workflowPathService != nil {
		wss := NewWorkflowStatusService(configService, workflowPathService)
		if err := wss.LoadStatus(); err != nil {
			log.Printf("Warning: Failed to load workflow status: %v", err)
		} else {
			workflowStatusService = wss
			status.Status = true
		}
	}

	var artifactService *ArtifactService
	arts := NewArtifactService(configService, workflowStatusService)
	if err := arts.LoadArtifacts(); err != nil {
		log.Printf("Warning: Failed to load artifacts: %v", err)
	} else {
		artifactService = arts
		status.Artifacts = true
	}

	var fileWatcherService *FileWatcherService
	if artifactService != nil && workflowStatusService != nil {
		fws := NewFileWatcherService(pm.hub, configService, artifactService, workflowStatusService)
		if err := fws.Start(); err != nil {
			log.Printf("Warning: Failed to start file watcher: %v", err)
		} else {
			fileWatcherService = fws
			status.Watcher = true
		}
	}

	// Phase 3: Atomic swap — acquire lock only to stop old services and assign new ones
	pm.mu.Lock()
	pm.stopServicesLocked()

	pm.configService = configService
	pm.projectRoot = projectRoot
	pm.projectName = projectName
	pm.workflowPathService = workflowPathService
	pm.agentService = agentService
	pm.workflowStatusService = workflowStatusService
	pm.artifactService = artifactService
	pm.fileWatcherService = fileWatcherService

	// Capture callback before releasing lock
	onLoaded := pm.OnProjectLoaded
	pm.mu.Unlock()

	// Call callback outside lock to avoid holding it during potentially slow operations
	if onLoaded != nil {
		onLoaded(projectRoot, projectName)
	}

	return &ProjectInfo{
		ProjectName: projectName,
		ProjectRoot: projectRoot,
		BmadLoaded:  true,
		Services:    status,
	}, nil
}

// stopServicesLocked stops all running services. Must be called with mu held.
func (pm *ProjectManager) stopServicesLocked() {
	if pm.fileWatcherService != nil {
		pm.fileWatcherService.Stop()
		pm.fileWatcherService = nil
	}
	pm.artifactService = nil
	pm.workflowStatusService = nil
	pm.agentService = nil
	pm.workflowPathService = nil
	pm.configService = nil
	pm.projectRoot = ""
	pm.projectName = ""
}

// Stop stops all running services. Safe to call from outside.
func (pm *ProjectManager) Stop() {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.stopServicesLocked()
}

func (pm *ProjectManager) ConfigService() *BMadConfigService {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.configService
}

func (pm *ProjectManager) WorkflowPathService() *WorkflowPathService {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.workflowPathService
}

func (pm *ProjectManager) AgentService() *AgentService {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.agentService
}

func (pm *ProjectManager) WorkflowStatusService() *WorkflowStatusService {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.workflowStatusService
}

func (pm *ProjectManager) ArtifactService() *ArtifactService {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.artifactService
}

func (pm *ProjectManager) FileWatcherService() *FileWatcherService {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.fileWatcherService
}

func (pm *ProjectManager) ProjectRoot() string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.projectRoot
}

func (pm *ProjectManager) ProjectName() string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.projectName
}

// ProjectError represents a project-specific error with code and message.
type ProjectError struct {
	Code    string
	Message string
}

func (e *ProjectError) Error() string {
	return e.Message
}
