import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderOpen, Settings } from 'lucide-react';

import { ActivityBar } from './components/layout/ActivityBar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import { useProjectStore } from './stores/project.store';
import { useAgentStore } from './stores/agent.store';
import { useChatStore } from './stores/chat.store';
import { useInsightStore } from './stores/insight.store';
import { usePhasesStore } from './stores/phases.store';
import { useWorkflowStore } from './stores/workflow.store';

import { openProject, loadRecentProjects } from './services/project.service';
import { selectProjectFolder } from './services/dialog.service';
import {
  connect as wsConnect,
  disconnect as wsDisconnect,
  on as wsOn,
} from './services/websocket.service';
import { loadWorkflowStatus } from './services/workflow.service';
import { loadPhases } from './services/phases.service';
import { initChatService } from './services/chat.service';
import { loadAgents } from './services/agent.service';
import { initProviderState } from './services/provider.service';

import { ChatPanel } from './components/chat/ChatPanel';
import { InsightPanel } from './components/insights/InsightPanel';
import { PhaseGraphContainer } from './components/phase-graph/PhaseGraphContainer';
import { WorkflowStatusDisplay } from './components/workflow/WorkflowStatusDisplay';
import { ProviderSettings } from './components/settings/ProviderSettings';

import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { Alert, AlertTitle, AlertDescription } from './components/ui/alert';
import { Badge } from './components/ui/badge';

type SectionId = 'graph' | 'chat' | 'insights' | 'artifacts';

export default function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('graph');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const project = useProjectStore(s => s.project);
  const loadingState = useProjectStore(s => s.loadingState);
  const recentProjects = useProjectStore(s => s.recentProjects);
  const bmadAvailable = useProjectStore(s => s.bmadServicesAvailable());

  // Refs for cleanup
  const wsUnsubscribeRef = useRef<(() => void) | null>(null);
  const chatCleanupRef = useRef<(() => void) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: loadingState.status === 'success',
    onSectionChange: setActiveSection,
  });

  // Initialize provider state on mount
  useEffect(() => {
    initProviderState();
  }, []);

  // Auto-load last active project on mount
  useEffect(() => {
    (async () => {
      await loadRecentProjects();
      const lastPath = useProjectStore.getState().lastActiveProjectPath;
      if (lastPath) {
        await openProject(lastPath);
        if (useProjectStore.getState().project) {
          wsConnect();
          setupWorkflowSubscription();
        }
      }
    })();

    return () => {
      cleanupWorkflow();
      wsDisconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupWorkflow() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (wsUnsubscribeRef.current) {
      wsUnsubscribeRef.current();
      wsUnsubscribeRef.current = null;
    }
    if (chatCleanupRef.current) {
      chatCleanupRef.current();
      chatCleanupRef.current = null;
    }
    useWorkflowStore.getState().clearWorkflowState();
    usePhasesStore.getState().clearPhasesState();
    useChatStore.getState().clearChatState();
    useInsightStore.getState().clearInsightState();
    useAgentStore.getState().clearAgentState();
  }

  function setupWorkflowSubscription() {
    cleanupWorkflow();
    wsUnsubscribeRef.current = wsOn('workflow:status-changed', () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        loadWorkflowStatus();
      }, 300);
    });
    chatCleanupRef.current = initChatService();
    loadWorkflowStatus();
    loadPhases();
    loadAgents()
      .then(() => {
        const agents = useAgentStore.getState().agents;
        if (agents.length > 0) {
          const defaultAgent =
            agents.find(a => a.id === 'analyst') ?? agents[0];
          useAgentStore.getState().setActiveAgent(defaultAgent.id);
        }
      })
      .catch(err => {
        console.warn(
          'Agent initialization failed:',
          err instanceof Error ? err.message : err,
        );
      });
  }

  const handleOpenProject = useCallback(async () => {
    const folder = await selectProjectFolder();
    if (folder) {
      cleanupWorkflow();
      wsDisconnect();
      await openProject(folder);
      if (useProjectStore.getState().project) {
        wsConnect();
        setupWorkflowSubscription();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenRecentProject = useCallback(async (path: string) => {
    cleanupWorkflow();
    wsDisconnect();
    await openProject(path);
    if (useProjectStore.getState().project) {
      wsConnect();
      setupWorkflowSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render states
  if (loadingState.status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-text-secondary text-[length:var(--text-md)]">
          Loading project...
        </p>
      </div>
    );
  }

  if (loadingState.status === 'error') {
    const isMissingBmad = loadingState.errorCode === 'bmad_not_found';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="mb-2 text-[length:var(--text-2xl)] font-semibold text-accent">
          BMAD Studio
        </h1>
        <Alert variant="destructive" className="mb-6 max-w-[480px]">
          <AlertTitle>
            {isMissingBmad
              ? 'No BMAD Configuration Found'
              : 'Error Opening Project'}
          </AlertTitle>
          <AlertDescription>{loadingState.error}</AlertDescription>
        </Alert>
        <Button onClick={handleOpenProject}>Select Different Folder</Button>
      </div>
    );
  }

  if (loadingState.status === 'idle' && !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="mb-2 text-[length:var(--text-2xl)] font-semibold text-accent">
          BMAD Studio
        </h1>
        <p className="mb-6 text-text-secondary text-[length:var(--text-md)]">
          Select a BMAD project folder to get started
        </p>

        {recentProjects.length > 0 && (
          <div className="mb-6 w-full max-w-[400px] text-left">
            <h3 className="mb-2 text-[length:var(--text-sm)] uppercase tracking-wide text-text-muted">
              Recent Projects
            </h3>
            {recentProjects.map(rp => (
              <div
                key={rp.path}
                className="cursor-pointer rounded-[var(--radius-md)] px-3 py-2 transition-colors duration-150 hover:bg-bg-secondary"
                onClick={() => handleOpenRecentProject(rp.path)}
              >
                <div className="text-[length:var(--text-md)] text-text-primary">
                  {rp.name}
                </div>
                <div className="mt-0.5 max-w-[280px] truncate text-[length:var(--text-xs)] text-text-muted">
                  {rp.path}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button size="lg" onClick={handleOpenProject}>
          Open Project
        </Button>
      </div>
    );
  }

  // Loaded state
  if (loadingState.status === 'success' && project) {
    return (
      <div className="flex min-h-screen flex-row">
        <ActivityBar
          activeSection={activeSection}
          onSectionChange={(s) => setActiveSection(s as SectionId)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="flex items-center border-b border-border-primary bg-bg-secondary px-4 py-3">
            <span className="text-[length:var(--text-lg)] font-semibold text-text-primary">
              {project.projectName}
            </span>
            {bmadAvailable && (
              <Badge variant="success" className="ml-2">
                BMAD
              </Badge>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleOpenProject}>
                <FolderOpen className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex flex-1 items-stretch justify-center">
            {activeSection === 'graph' && (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <PhaseGraphContainer />
                <WorkflowStatusDisplay />
              </div>
            )}
            {activeSection === 'chat' && <ChatPanel />}
            {activeSection === 'insights' && <InsightPanel />}
            {activeSection === 'artifacts' && (
              <div className="flex flex-1 items-center justify-center text-text-muted">
                Artifacts panel (Epic 6)
              </div>
            )}
          </div>
        </div>

        <ProviderSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    );
  }

  return null;
}
