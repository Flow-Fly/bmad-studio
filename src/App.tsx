import { useEffect, useCallback, useRef } from 'react';

import { AppShell } from '@/components/layout/AppShell';

import { useProjectStore } from '@/stores/project.store';
import { useAgentStore } from '@/stores/agent.store';
import { useChatStore } from '@/stores/chat.store';
import { useInsightStore } from '@/stores/insight.store';
import { usePhasesStore } from '@/stores/phases.store';
import { useWorkflowStore } from '@/stores/workflow.store';

import { openProject, loadRecentProjects } from '@/services/project.service';
import { selectProjectFolder } from '@/services/dialog.service';
import {
  connect as wsConnect,
  disconnect as wsDisconnect,
  on as wsOn,
} from '@/services/websocket.service';
import { loadWorkflowStatus } from '@/services/workflow.service';
import { loadPhases } from '@/services/phases.service';
import { initChatService } from '@/services/chat.service';
import { loadAgents } from '@/services/agent.service';
import { initProviderState } from '@/services/provider.service';

import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function App() {
  const project = useProjectStore(s => s.project);
  const loadingState = useProjectStore(s => s.loadingState);

  // Refs for cleanup
  const wsUnsubscribeRef = useRef<(() => void) | null>(null);
  const chatCleanupRef = useRef<(() => void) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleProjectOpened = useCallback(() => {
    wsConnect();
    setupWorkflowSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectFolder = useCallback(async () => {
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

  // Loading state
  if (loadingState.status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base">
        <Spinner size="lg" />
        <p className="text-[length:var(--text-md)] text-interactive-default">
          Loading project...
        </p>
      </div>
    );
  }

  // Error state
  if (loadingState.status === 'error') {
    const isMissingBmad = loadingState.errorCode === 'bmad_not_found';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base p-4 text-center">
        <h1 className="mb-2 text-[length:var(--text-2xl)] font-semibold text-interactive-accent">
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
        <Button onClick={handleSelectFolder}>Select Different Folder</Button>
      </div>
    );
  }

  // Idle (no project) or loaded (has project) — both go through AppShell
  return (
    <AppShell
      hasProject={loadingState.status === 'success' && project !== null}
      onProjectOpened={handleProjectOpened}
    />
  );
}
