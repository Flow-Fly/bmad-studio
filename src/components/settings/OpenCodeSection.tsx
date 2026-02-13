import { useState } from 'react';
import { ExternalLink, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  useOpenCodeStore,
  useOpenCodeInstalled,
  useOpenCodeConfigured,
  useOpenCodeProviders,
} from '../../stores/opencode.store';

export function OpenCodeSection() {
  const [isRedetecting, setIsRedetecting] = useState(false);
  const [redetectMessage, setRedetectMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const installed = useOpenCodeInstalled();
  const configured = useOpenCodeConfigured();
  const providers = useOpenCodeProviders();
  const { serverStatus, opencodePath, opencodeVersion, models, redetectOpenCode } =
    useOpenCodeStore();

  const handleRedetect = async () => {
    setIsRedetecting(true);
    setRedetectMessage(null);

    try {
      await redetectOpenCode();

      // Give IPC events time to propagate
      setTimeout(() => {
        const state = useOpenCodeStore.getState();
        if (state.installed) {
          setRedetectMessage({
            type: 'success',
            text: 'OpenCode detected successfully',
          });
        } else {
          setRedetectMessage({
            type: 'error',
            text: 'OpenCode not found on PATH',
          });
        }
        setIsRedetecting(false);
      }, 500);
    } catch (error) {
      setRedetectMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Re-detection failed',
      });
      setIsRedetecting(false);
    }
  };

  const getStatusDisplay = () => {
    if (!installed) {
      return {
        icon: <XCircle className="h-5 w-5 text-error-default" />,
        text: 'Not Detected',
        color: 'text-error-default',
      };
    }

    if (!configured) {
      return {
        icon: <AlertCircle className="h-5 w-5 text-warning-default" />,
        text: 'Not Configured',
        color: 'text-warning-default',
      };
    }

    if (serverStatus === 'ready') {
      return {
        icon: <CheckCircle className="h-5 w-5 text-success-default" />,
        text: 'Ready',
        color: 'text-success-default',
      };
    }

    if (serverStatus === 'connecting' || serverStatus === 'restarting') {
      return {
        icon: <AlertCircle className="h-5 w-5 text-warning-default" />,
        text: 'Connecting',
        color: 'text-warning-default',
      };
    }

    if (serverStatus === 'error') {
      return {
        icon: <XCircle className="h-5 w-5 text-error-default" />,
        text: 'Error',
        color: 'text-error-default',
      };
    }

    return {
      icon: <CheckCircle className="h-5 w-5 text-success-default" />,
      text: 'Detected',
      color: 'text-success-default',
    };
  };

  const status = getStatusDisplay();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
          OpenCode Configuration
        </h2>
        <p className="mt-1 text-[length:var(--text-sm)] text-interactive-muted">
          OpenCode is required to run AI workflows and sessions
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-overlay p-4">
        <div className="flex items-center gap-3">
          {status.icon}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--text-md)] font-medium text-interactive-default">
                Status:
              </span>
              <span className={`text-[length:var(--text-md)] font-semibold ${status.color}`}>
                {status.text}
              </span>
            </div>
            {opencodePath && (
              <div className="mt-1 text-[length:var(--text-sm)] text-interactive-muted">
                Path: <code className="font-mono">{opencodePath}</code>
              </div>
            )}
            {opencodeVersion && (
              <div className="mt-0.5 text-[length:var(--text-sm)] text-interactive-muted">
                Version: {opencodeVersion}
              </div>
            )}
          </div>
        </div>

        {!installed && (
          <div className="space-y-3 pt-3 border-t border-border-subtle">
            <p className="text-[length:var(--text-sm)] text-interactive-default">
              OpenCode is required to enable AI workflows. Install OpenCode to get started.
            </p>
            <a
              href="https://docs.opencode.ai/installation"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[length:var(--text-sm)] font-medium text-interactive-active hover:text-interactive-hover transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Install Instructions
            </a>
          </div>
        )}

        {installed && !configured && (
          <div className="space-y-3 pt-3 border-t border-border-subtle">
            <p className="text-[length:var(--text-sm)] text-interactive-default">
              OpenCode is installed but not configured. Configure providers to enable AI
              sessions.
            </p>
            <a
              href="https://docs.opencode.ai/configuration"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[length:var(--text-sm)] font-medium text-interactive-active hover:text-interactive-hover transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Configuration Guide
            </a>
          </div>
        )}

        {installed && configured && providers.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border-subtle">
            <div>
              <h3 className="text-[length:var(--text-sm)] font-semibold text-interactive-default mb-2">
                Providers
              </h3>
              <ul className="space-y-1">
                {providers.map((provider) => (
                  <li
                    key={provider.name}
                    className="flex items-center gap-2 text-[length:var(--text-sm)]"
                  >
                    {provider.configured ? (
                      <CheckCircle className="h-4 w-4 text-success-default" />
                    ) : (
                      <XCircle className="h-4 w-4 text-error-default" />
                    )}
                    <span className="text-interactive-default capitalize">
                      {provider.name}
                    </span>
                    <span className="text-interactive-muted">
                      ({provider.configured ? 'configured' : 'not configured'})
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {models.length > 0 && (
              <div>
                <h3 className="text-[length:var(--text-sm)] font-semibold text-interactive-default mb-2">
                  Models
                </h3>
                <ul className="space-y-1">
                  {models.map((model) => (
                    <li
                      key={model}
                      className="text-[length:var(--text-sm)] text-interactive-muted"
                    >
                      • {model}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="pt-3 border-t border-border-subtle">
          <button
            onClick={handleRedetect}
            disabled={isRedetecting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-interactive-active text-surface-base text-[length:var(--text-sm)] font-medium hover:bg-interactive-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${isRedetecting ? 'animate-spin' : ''}`} />
            {isRedetecting ? 'Detecting...' : 'Re-detect OpenCode'}
          </button>

          {redetectMessage && (
            <div
              className={`mt-3 text-[length:var(--text-sm)] ${
                redetectMessage.type === 'success'
                  ? 'text-success-default'
                  : 'text-error-default'
              }`}
            >
              {redetectMessage.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
