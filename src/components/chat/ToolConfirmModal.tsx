import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { useChatStore } from '../../stores/chat.store';
import { sendToolApprove } from '../../services/chat.service';
import { TOOL_HINTS, isDangerousTool } from '../../types/tool';

function explainBashCommand(command: string): string {
  const trimmed = command.trim();
  if (trimmed.startsWith('rm ') || trimmed.startsWith('rm\t')) return `Delete files: ${trimmed.slice(3).trim()}`;
  if (trimmed.startsWith('mv ')) return 'Move or rename files';
  if (trimmed.startsWith('cp ')) return 'Copy files';
  if (trimmed.startsWith('chmod ')) return 'Change file permissions';
  if (trimmed.startsWith('chown ')) return 'Change file ownership';
  if (trimmed.includes('sudo')) return 'Run with elevated privileges';
  if (trimmed.includes('>') || trimmed.includes('>>')) return 'Write to file via redirect';
  const preview = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
  return `Execute: ${preview}`;
}

function getExplanation(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === 'bash') {
    const command = input.command as string;
    if (command) return explainBashCommand(command);
  }
  if (toolName === 'file_write') {
    const path = input.path as string;
    if (path) return `Write to: ${path}`;
  }
  return null;
}

export function ToolConfirmModal() {
  const pending = useChatStore(s => s.pendingToolConfirm);
  const dismissToolForSession = useChatStore(s => s.dismissToolForSession);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!pending) return null;

  const hint = TOOL_HINTS[pending.toolName] ?? 'Execute a tool';
  const explanation = getExplanation(pending.toolName, pending.input);
  const dangerous = isDangerousTool(pending.toolName);

  const handleApprove = () => {
    if (dontAskAgain) {
      dismissToolForSession(pending.toolName);
    }
    sendToolApprove(pending.toolId, true);
    setDontAskAgain(false);
  };

  const handleDeny = () => {
    sendToolApprove(pending.toolId, false);
    setDontAskAgain(false);
  };

  return (
    <Dialog open={true}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-[480px]"
      >
        <DialogHeader>
          <DialogTitle>Tool Confirmation</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="font-mono text-[length:var(--text-lg)] font-medium text-text-primary">
            {pending.toolName}
          </div>
          <div className="text-[length:var(--text-sm)] leading-relaxed text-text-secondary">
            {hint}
          </div>

          {explanation && (
            <div className="rounded-[var(--radius-md)] border-l-[3px] border-warning bg-bg-tertiary px-3 py-2">
              <div className="mb-1 text-[length:var(--text-xs)] font-medium text-warning">
                This will:
              </div>
              <div className="break-words font-mono text-[length:var(--text-sm)] text-text-primary">
                {explanation}
              </div>
            </div>
          )}

          <pre className="max-h-[150px] overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-border-secondary bg-bg-primary px-3 py-2 font-mono text-[length:var(--text-xs)] text-text-secondary">
            {JSON.stringify(pending.input, null, 2)}
          </pre>

          {dangerous && (
            <label className="mt-1 flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={dontAskAgain}
                onCheckedChange={(checked) => setDontAskAgain(checked === true)}
              />
              <span className="text-[length:var(--text-sm)] text-text-secondary">
                Don't ask again this session
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleDeny}>
            Deny
          </Button>
          <Button onClick={handleApprove}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
