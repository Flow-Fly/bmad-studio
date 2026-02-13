import { AlertCircle, Loader2 } from 'lucide-react';
import { useSidecarStatus, useErrorMessage } from '@/stores/sidecar.store';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function SidecarStatus() {
  const status = useSidecarStatus();
  const errorMessage = useErrorMessage();

  if (status === 'ready') {
    // Normal operation — show nothing or subtle indicator
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            {status === 'connecting' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-warning" />
                <span className="text-sm text-text-muted">Connecting to backend...</span>
              </>
            )}
            {status === 'restarting' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-warning" />
                <span className="text-sm text-warning">Backend restarting...</span>
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="h-4 w-4 text-error" />
                <span className="text-sm text-error">Backend unavailable</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {status === 'connecting' && 'Waiting for backend to start...'}
          {status === 'restarting' && 'Backend crashed and is restarting...'}
          {status === 'error' && (errorMessage || 'Backend failed to start. Some features may be unavailable.')}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
