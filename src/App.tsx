import { useEffect, useCallback, useRef } from 'react';

import { AppShell } from '@/components/layout/AppShell';

import { useProjectStore } from '@/stores/project.store';

import { openProject, loadRecentProjects } from '@/services/project.service';
import { selectProjectFolder } from '@/services/dialog.service';
import {
  connect as wsConnect,
  disconnect as wsDisconnect,
  registerStreamEventHandlers,
} from '@/services/websocket.service';
import { fetchStreams } from '@/services/stream.service';

import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function App() {
  const project = useProjectStore(s => s.project);
  const loadingState = useProjectStore(s => s.loadingState);

  // Refs for cleanup
  const wsEventCleanupRef = useRef<(() => void) | null>(null);

  function cleanupConnections() {
    if (wsEventCleanupRef.current) {
      wsEventCleanupRef.current();
      wsEventCleanupRef.current = null;
    }
  }

  function setupStreamSubscription(projectName: string) {
    cleanupConnections();
    wsEventCleanupRef.current = registerStreamEventHandlers();
    fetchStreams(projectName);
  }

  // Auto-load last active project on mount
  useEffect(() => {
    (async () => {
      await loadRecentProjects();
      const lastPath = useProjectStore.getState().lastActiveProjectPath;
      if (lastPath) {
        await openProject(lastPath);
        const currentProject = useProjectStore.getState().project;
        if (currentProject) {
          wsConnect();
          setupStreamSubscription(currentProject.projectName);
        }
      }
    })();

    return () => {
      cleanupConnections();
      wsDisconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProjectOpened = useCallback(() => {
    const currentProject = useProjectStore.getState().project;
    if (currentProject) {
      wsConnect();
      setupStreamSubscription(currentProject.projectName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectFolder = useCallback(async () => {
    const folder = await selectProjectFolder();
    if (folder) {
      cleanupConnections();
      wsDisconnect();
      await openProject(folder);
      const currentProject = useProjectStore.getState().project;
      if (currentProject) {
        wsConnect();
        setupStreamSubscription(currentProject.projectName);
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
