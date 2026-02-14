import { useCallback } from 'react';
import { FolderOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { selectProjectFolder } from '@/services/dialog.service';
import { openProject, fetchRegisteredProjects } from '@/services/project.service';
import { useProjectStore } from '@/stores/project.store';

export function DashboardEmptyState() {
  const handleOpenFolder = useCallback(async () => {
    const folder = await selectProjectFolder();
    if (folder) {
      await openProject(folder);
      if (useProjectStore.getState().project) {
        await fetchRegisteredProjects();
      }
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-surface-base p-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] bg-surface-raised">
        <FolderOpen className="h-8 w-8 text-interactive-accent" />
      </div>

      <h2 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
        Open a project folder to get started
      </h2>
      <p className="mt-2 max-w-[400px] text-[length:var(--text-sm)] text-interactive-muted">
        BMAD Studio helps you manage development streams, track phases, and orchestrate workflows
        across your projects.
      </p>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="lg" className="mt-6" onClick={handleOpenFolder}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open Project
          </Button>
        </TooltipTrigger>
        <TooltipContent>Select a project folder to register it</TooltipContent>
      </Tooltip>
    </div>
  );
}
