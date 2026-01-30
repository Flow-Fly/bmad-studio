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

	// Current project info
	projectRoot string
	projectName string

	// BMAD services (nil when no project loaded)
	configService         *BMadConfigService
	workflowPathService   *WorkflowPathService
	agentService          *AgentService
	workflowStatusService *WorkflowStatusService
	artifactService       *ArtifactService
	fileWatcherService    *FileWatcherService
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
// It stops any existing services first, then re-initializes for the new path.
func (pm *ProjectManager) LoadProject(projectRoot string) (*ProjectInfo, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Validate path exists
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

	// Check for _bmad/ directory
	bmadPath := filepath.Join(projectRoot, "_bmad")
	if _, err := os.Stat(bmadPath); os.IsNotExist(err) {
		return nil, &ProjectError{
			Code:    "bmad_not_found",
			Message: "No BMAD configuration found in the selected folder. Ensure the project has _bmad/bmm/config.yaml or run npx bmad-method install.",
		}
	}

	// Stop existing services
	pm.stopServicesLocked()

	// Initialize config service
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

	pm.configService = configService
	pm.projectRoot = projectRoot
	pm.projectName = filepath.Base(projectRoot)

	status := ServiceStatus{Config: true}

	// Initialize workflow path service
	workflowPathService := NewWorkflowPathService(configService)
	if err := workflowPathService.LoadPaths(); err != nil {
		log.Printf("Warning: Failed to load workflow paths: %v", err)
	} else {
		pm.workflowPathService = workflowPathService
		status.Phases = true
	}

	// Initialize agent service
	agentService := NewAgentService(configService)
	if err := agentService.LoadAgents(); err != nil {
		log.Printf("Warning: Failed to load agents: %v", err)
	} else {
		pm.agentService = agentService
		status.Agents = true
	}

	// Initialize workflow status service
	if pm.workflowPathService != nil {
		workflowStatusService := NewWorkflowStatusService(configService, pm.workflowPathService)
		if err := workflowStatusService.LoadStatus(); err != nil {
			log.Printf("Warning: Failed to load workflow status: %v", err)
		} else {
			pm.workflowStatusService = workflowStatusService
			status.Status = true
		}
	}

	// Initialize artifact service
	artifactService := NewArtifactService(configService, pm.workflowStatusService)
	if err := artifactService.LoadArtifacts(); err != nil {
		log.Printf("Warning: Failed to load artifacts: %v", err)
	} else {
		pm.artifactService = artifactService
		status.Artifacts = true
	}

	// Initialize file watcher service
	if pm.artifactService != nil && pm.workflowStatusService != nil {
		fileWatcherService := NewFileWatcherService(pm.hub, configService, pm.artifactService, pm.workflowStatusService)
		if err := fileWatcherService.Start(); err != nil {
			log.Printf("Warning: Failed to start file watcher: %v", err)
		} else {
			pm.fileWatcherService = fileWatcherService
			status.Watcher = true
		}
	}

	return &ProjectInfo{
		ProjectName: pm.projectName,
		ProjectRoot: pm.projectRoot,
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

// Getters for handler access (thread-safe)

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
