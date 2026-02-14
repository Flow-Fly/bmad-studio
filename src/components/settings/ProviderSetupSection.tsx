import { useState, useCallback } from 'react';
import {
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  useOpenCodeStore,
  useOpenCodeProviders,
} from '../../stores/opencode.store';
import { DefaultModelSelector } from './DefaultModelSelector';

interface ProviderCardState {
  apiKey: string;
  endpoint: string;
  showKey: boolean;
  validating: boolean;
  saving: boolean;
  validationResult: { type: 'success' | 'error'; text: string } | null;
  saveResult: { type: 'success' | 'error'; text: string } | null;
  discoveredModels: string[];
}

const KNOWN_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', needsEndpoint: false },
  { id: 'openai', name: 'OpenAI', needsEndpoint: false },
  { id: 'ollama', name: 'Ollama', needsEndpoint: true },
  { id: 'gemini', name: 'Gemini', needsEndpoint: false },
] as const;

function maskApiKey(key: string): string {
  if (!key || key.length < 10) return key ? '***' : '';
  return `${key.slice(0, 3)}...${key.slice(-6)}`;
}

function ProviderCard({
  providerId,
  providerName,
  needsEndpoint,
  isConfigured,
}: {
  providerId: string;
  providerName: string;
  needsEndpoint: boolean;
  isConfigured: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<ProviderCardState>({
    apiKey: '',
    endpoint: providerId === 'ollama' ? 'http://localhost:11434' : '',
    showKey: false,
    validating: false,
    saving: false,
    validationResult: null,
    saveResult: null,
    discoveredModels: [],
  });

  // Load masked key when expanding for the first time
  const handleToggle = useCallback(async () => {
    if (!expanded && isConfigured) {
      try {
        const fullKey = await window.electronAPI.getApiKey(providerId);
        if (fullKey) {
          setState((prev) => ({
            ...prev,
            apiKey: fullKey,
          }));
        }
      } catch {
        // Ignore — keychain read failure is non-fatal
      }
    }
    setExpanded((prev) => !prev);
  }, [expanded, isConfigured, providerId]);

  const handleValidate = async () => {
    setState((prev) => ({
      ...prev,
      validating: true,
      validationResult: null,
    }));

    try {
      const result = await window.opencode.validateProvider({
        provider: providerId,
        apiKey: state.apiKey,
        endpoint: needsEndpoint ? state.endpoint : undefined,
      });

      setState((prev) => ({
        ...prev,
        validating: false,
        validationResult: result.success
          ? { type: 'success', text: 'Credentials are valid' }
          : { type: 'error', text: result.error ?? 'Validation failed' },
        discoveredModels: result.models ?? prev.discoveredModels,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        validating: false,
        validationResult: {
          type: 'error',
          text: error instanceof Error ? error.message : 'Validation failed',
        },
      }));
    }
  };

  const handleSave = async () => {
    setState((prev) => ({ ...prev, saving: true, saveResult: null }));

    try {
      // Store key in encrypted keychain
      await window.electronAPI.setApiKey(providerId, state.apiKey);

      // Write config to OpenCode config file
      const writeResult = await window.opencode.writeConfig({
        provider: providerId,
        apiKey: state.apiKey,
        endpoint: needsEndpoint ? state.endpoint : undefined,
        models: state.discoveredModels.length > 0 ? state.discoveredModels : undefined,
      });

      if (!writeResult.success) {
        setState((prev) => ({
          ...prev,
          saving: false,
          saveResult: {
            type: 'error',
            text: writeResult.error ?? 'Failed to write config',
          },
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        saving: false,
        saveResult: { type: 'success', text: 'Configuration saved' },
        showKey: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        saving: false,
        saveResult: {
          type: 'error',
          text: error instanceof Error ? error.message : 'Save failed',
        },
      }));
    }
  };

  const handleDelete = async () => {
    try {
      await window.electronAPI.deleteApiKey(providerId);
      setState((prev) => ({
        ...prev,
        apiKey: '',
        saveResult: { type: 'success', text: 'API key removed' },
        validationResult: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        saveResult: {
          type: 'error',
          text: error instanceof Error ? error.message : 'Delete failed',
        },
      }));
    }
  };

  const canValidate =
    providerId === 'ollama' ? !!state.endpoint : !!state.apiKey;
  const canSave = providerId === 'ollama' ? !!state.endpoint : !!state.apiKey;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-overlay">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-base/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <Key className="h-4 w-4 text-interactive-muted" />
          <span className="text-[length:var(--text-md)] font-medium text-interactive-default">
            {providerName}
          </span>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1 text-[length:var(--text-sm)] text-success-default">
              <CheckCircle className="h-3.5 w-3.5" />
              Configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[length:var(--text-sm)] text-error-default">
              <XCircle className="h-3.5 w-3.5" />
              Not configured
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-interactive-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-interactive-muted" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border-subtle px-4 pb-4 pt-3 space-y-3">
          {/* API Key field (not needed for Ollama) */}
          {providerId !== 'ollama' && (
            <div>
              <label className="block text-[length:var(--text-sm)] text-interactive-muted mb-1">
                API Key
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={state.showKey ? 'text' : 'password'}
                    value={
                      state.showKey
                        ? state.apiKey
                        : state.apiKey
                          ? maskApiKey(state.apiKey)
                          : ''
                    }
                    onChange={(e) => {
                      // Only update if showing full key (not masked)
                      if (state.showKey || !state.apiKey) {
                        setState((prev) => ({
                          ...prev,
                          apiKey: e.target.value,
                          validationResult: null,
                          saveResult: null,
                        }));
                      }
                    }}
                    onFocus={() => {
                      // Switch to show mode on focus if key exists to allow editing
                      if (state.apiKey && !state.showKey) {
                        setState((prev) => ({ ...prev, showKey: true }));
                      }
                    }}
                    placeholder={`Enter ${providerName} API key`}
                    className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-[length:var(--text-sm)] text-interactive-default placeholder:text-interactive-muted focus:border-interactive-active focus:outline-none font-mono"
                  />
                </div>
                <button
                  onClick={() =>
                    setState((prev) => ({ ...prev, showKey: !prev.showKey }))
                  }
                  className="p-2 rounded-md hover:bg-surface-base transition-colors text-interactive-muted"
                  title={state.showKey ? 'Hide key' : 'Show key'}
                >
                  {state.showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Endpoint field (for Ollama, or optionally other providers) */}
          {needsEndpoint && (
            <div>
              <label className="block text-[length:var(--text-sm)] text-interactive-muted mb-1">
                Endpoint
              </label>
              <input
                type="text"
                value={state.endpoint}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    endpoint: e.target.value,
                    validationResult: null,
                    saveResult: null,
                  }))
                }
                placeholder="http://localhost:11434"
                className="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-[length:var(--text-sm)] text-interactive-default placeholder:text-interactive-muted focus:border-interactive-active focus:outline-none font-mono"
              />
            </div>
          )}

          {/* Discovered models */}
          {state.discoveredModels.length > 0 && (
            <div>
              <label className="block text-[length:var(--text-sm)] text-interactive-muted mb-1">
                Discovered Models
              </label>
              <div className="flex flex-wrap gap-1.5">
                {state.discoveredModels.map((model) => (
                  <span
                    key={model}
                    className="inline-block rounded-md bg-surface-base px-2 py-0.5 text-[length:var(--text-sm)] text-interactive-muted font-mono"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleValidate}
              disabled={!canValidate || state.validating}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle bg-surface-base text-[length:var(--text-sm)] font-medium text-interactive-default hover:bg-interactive-active hover:text-surface-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.validating ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
              {state.validating ? 'Validating...' : 'Validate'}
            </button>

            <button
              onClick={handleSave}
              disabled={!canSave || state.saving}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-interactive-active text-surface-base text-[length:var(--text-sm)] font-medium hover:bg-interactive-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.saving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              {state.saving ? 'Saving...' : 'Save'}
            </button>

            {isConfigured && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-error-default/30 text-[length:var(--text-sm)] font-medium text-error-default hover:bg-error-default/10 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>

          {/* Validation result */}
          {state.validationResult && (
            <div
              className={`flex items-center gap-2 text-[length:var(--text-sm)] ${
                state.validationResult.type === 'success'
                  ? 'text-success-default'
                  : 'text-error-default'
              }`}
            >
              {state.validationResult.type === 'success' ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {state.validationResult.text}
            </div>
          )}

          {/* Save result */}
          {state.saveResult && (
            <div
              className={`flex items-center gap-2 text-[length:var(--text-sm)] ${
                state.saveResult.type === 'success'
                  ? 'text-success-default'
                  : 'text-error-default'
              }`}
            >
              {state.saveResult.type === 'success' ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {state.saveResult.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProviderSetupSection() {
  const installed = useOpenCodeStore((s) => s.installed);
  const providers = useOpenCodeProviders();

  // Only render when OpenCode is installed
  if (!installed) {
    return null;
  }

  // Build a lookup of configured providers from detection
  const configuredMap = new Map(
    providers.map((p) => [p.name.toLowerCase(), p.configured])
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[length:var(--text-lg)] font-semibold text-interactive-active">
          Provider Configuration
        </h2>
        <p className="mt-1 text-[length:var(--text-sm)] text-interactive-muted">
          Configure API keys for AI providers. Keys are stored encrypted in the OS keychain.
        </p>
      </div>

      <div className="space-y-3">
        {KNOWN_PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            providerId={provider.id}
            providerName={provider.name}
            needsEndpoint={provider.needsEndpoint}
            isConfigured={configuredMap.get(provider.id) ?? false}
          />
        ))}
      </div>

      <DefaultModelSelector />
    </div>
  );
}
