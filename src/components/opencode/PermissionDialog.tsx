import { useCallback, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  useCurrentPermission,
  useOpenCodeStore,
} from '../../stores/opencode.store';

/**
 * PermissionDialog renders a modal when the agent requests tool permission.
 *
 * The dialog is controlled by the permission queue in the store:
 * - `open` when `currentPermission !== null`
 * - Cannot be dismissed via overlay click, Escape (default), or X button
 * - User must explicitly Approve or Deny
 * - Enter approves, Escape denies (custom handlers)
 * - Queue ensures sequential display of multiple requests
 */
export function PermissionDialog() {
  const currentPermission = useCurrentPermission();
  const approveRef = useRef<HTMLButtonElement>(null);

  const handleApprove = useCallback(async () => {
    if (!currentPermission) return;

    try {
      await window.opencode.approvePermission(
        currentPermission.sessionId,
        currentPermission.permissionId,
        true,
      );
    } catch (error) {
      console.error('[PermissionDialog] Failed to approve permission:', error);
    }

    useOpenCodeStore.getState().dequeuePermission();
  }, [currentPermission]);

  const handleDeny = useCallback(async () => {
    if (!currentPermission) return;

    try {
      await window.opencode.approvePermission(
        currentPermission.sessionId,
        currentPermission.permissionId,
        false,
      );
    } catch (error) {
      console.error('[PermissionDialog] Failed to deny permission:', error);
    }

    useOpenCodeStore.getState().dequeuePermission();
  }, [currentPermission]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Prevent double-fire if focus is already on the Approve button
        if (document.activeElement === approveRef.current) return;
        e.preventDefault();
        handleApprove();
      }
    },
    [handleApprove],
  );

  const isOpen = currentPermission !== null;

  return (
    <DialogPrimitive.Root open={isOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--bmad-z-modal)] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleDeny();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onKeyDown={handleKeyDown}
          className="fixed left-1/2 top-1/2 z-[var(--bmad-z-modal)] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-border-primary bg-bg-secondary p-6 shadow-lg"
        >
          {/* Header */}
          <div className="flex flex-col gap-1.5 mb-4">
            <DialogPrimitive.Title className="flex items-center gap-2 text-[length:var(--text-lg)] font-semibold text-text-primary">
              <Shield className="h-5 w-5 text-accent" />
              {currentPermission?.tool ?? 'Permission Request'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-[length:var(--text-sm)] text-text-secondary">
              The agent wants to use this tool. Review the parameters and approve or deny.
            </DialogPrimitive.Description>
          </div>

          {/* Parameters display */}
          <div className="mb-4">
            <ParamsDisplay params={currentPermission?.params} />
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDeny}>
                Deny
              </Button>
              <Button ref={approveRef} onClick={handleApprove}>
                Approve
              </Button>
            </div>
            <p className="text-right text-[length:var(--text-xs)] text-text-tertiary">
              Enter to approve, Escape to deny
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Renders the tool parameters in a readable format.
 * - Empty/undefined params show "No parameters"
 * - Simple string values with path-like content use monospace
 * - Complex objects render as formatted JSON in a pre block
 */
function ParamsDisplay({ params }: { params?: Record<string, unknown> }) {
  if (!params || Object.keys(params).length === 0) {
    return (
      <p className="text-[length:var(--text-sm)] text-text-tertiary italic">
        No parameters
      </p>
    );
  }

  return (
    <pre
      className={cn(
        'overflow-auto rounded-[var(--radius-md)] bg-bg-tertiary p-3',
        'text-[length:var(--text-sm)] font-mono text-text-primary',
        'max-h-60',
      )}
    >
      {JSON.stringify(params, null, 2)}
    </pre>
  );
}
