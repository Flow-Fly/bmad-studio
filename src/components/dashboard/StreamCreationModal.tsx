import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FlowTemplateSelector } from '@/components/dashboard/FlowTemplateSelector';

type FlowType = 'full' | 'quick';

const STREAM_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

interface StreamCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStreamCreated: (streamName: string) => void;
}

function validateStreamName(name: string): string | null {
  if (!name.trim()) {
    return 'Stream name is required';
  }
  if (!STREAM_NAME_REGEX.test(name)) {
    return 'Name must start with a letter or number and contain only letters, numbers, hyphens, and underscores';
  }
  return null;
}

export function StreamCreationModal({
  open,
  onOpenChange,
  onStreamCreated,
}: StreamCreationModalProps) {
  const [name, setName] = useState('');
  const [flowType, setFlowType] = useState<FlowType>('full');
  const [createWorktree, setCreateWorktree] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input on open
  useEffect(() => {
    if (open) {
      // Use a short delay to ensure the dialog is rendered before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setName('');
        setFlowType('full');
        setCreateWorktree(true);
        setError(null);
        setCreating(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleSubmit = useCallback(async () => {
    const validationError = validateStreamName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setCreating(true);

    try {
      // Import dynamically to avoid circular deps at module scope
      const { createStreamWithWorktree } = await import('@/services/stream.service');
      const { useProjectStore } = await import('@/stores/project.store');

      const projectId = useProjectStore.getState().activeProjectName;
      if (!projectId) {
        setError('No active project selected');
        setCreating(false);
        return;
      }

      const stream = await createStreamWithWorktree(projectId, name, createWorktree);
      if (!stream) {
        // Check if the error was a 409 conflict
        const { useStreamStore } = await import('@/stores/stream.store');
        const storeError = useStreamStore.getState().error;
        if (storeError?.includes('409') || storeError?.toLowerCase().includes('already exists')) {
          setError('A stream with this name already exists');
        } else {
          setError(storeError ?? 'Failed to create stream');
        }
        setCreating(false);
        return;
      }

      // Success — close modal, notify parent
      handleOpenChange(false);
      onStreamCreated(stream.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create stream';
      if (message.includes('409') || message.toLowerCase().includes('already exists')) {
        setError('A stream with this name already exists');
      } else {
        setError(message);
      }
      setCreating(false);
    }
  }, [name, createWorktree, handleOpenChange, onStreamCreated]);

  const handleBlur = useCallback(() => {
    if (name.length > 0) {
      const validationError = validateStreamName(name);
      setError(validationError);
    }
  }, [name]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
      // Clear error on change if there was one and user is correcting
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && name.trim()) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [name, handleSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Stream</DialogTitle>
          <DialogDescription>Create a new development stream to track a feature or idea.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Stream Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="stream-name"
              className="text-[length:var(--text-sm)] font-medium text-text-primary"
            >
              Name
            </label>
            <Input
              ref={inputRef}
              id="stream-name"
              value={name}
              onChange={handleNameChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="my-feature"
              disabled={creating}
              aria-invalid={!!error}
              aria-describedby={error ? 'stream-name-error' : undefined}
            />
            {error && (
              <p
                id="stream-name-error"
                className="text-[length:var(--text-xs)] text-error"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          {/* Flow Template */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[length:var(--text-sm)] font-medium text-text-primary">
              Flow Template
            </label>
            <FlowTemplateSelector value={flowType} onChange={setFlowType} />
          </div>

          {/* Worktree Checkbox */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-worktree"
                checked={createWorktree}
                onCheckedChange={(checked) => setCreateWorktree(checked === true)}
                disabled={creating}
              />
              <label
                htmlFor="create-worktree"
                className="cursor-pointer text-[length:var(--text-sm)] text-text-primary"
              >
                Create git worktree
              </label>
            </div>
            {createWorktree && name.trim() && (
              <p className="ml-6 text-[length:var(--text-xs)] text-interactive-muted">
                Branch: <code className="font-mono">stream/{name.trim()}</code>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={creating || !name.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
