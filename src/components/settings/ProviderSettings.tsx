import { useState, useRef, useCallback, useEffect } from 'react';
import { useProviderStore } from '../../stores/provider.store';
import type { ProviderType, Model } from '../../types/provider';
import type { TrustLevel } from '../../types/tool';
import {
  validateProvider,
  listModels,
  loadSettings,
  saveSettings,
  setApiKey,
  hasApiKey,
  friendlyValidationError,
} from '../../services/provider.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';

interface ProviderSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ApiKeyProvider = 'claude' | 'openai' | 'gemini';

const API_KEY_LABELS: Record<ApiKeyProvider, string> = {
  claude: 'Claude API Key',
  openai: 'OpenAI API Key',
  gemini: 'Gemini API Key',
};

const API_KEY_PLACEHOLDERS: Record<ApiKeyProvider, string> = {
  claude: 'sk-ant-...',
  openai: 'sk-...',
  gemini: 'AIza...',
};

const API_KEY_HELP: Record<ApiKeyProvider, string> = {
  claude: 'Your Anthropic API key',
  openai: 'Your OpenAI API key',
  gemini: 'Your Google AI Studio API key',
};

export function ProviderSettings({ open, onOpenChange }: ProviderSettingsProps) {
  const [activeTab, setActiveTab] = useState<string>('claude');
  const [keySaved, setKeySaved] = useState<Record<string, boolean>>({});
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOnlyToolCapable, setShowOnlyToolCapable] = useState(false);

  // Input refs for API key fields (we don't store key values in state)
  const keyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Store state
  const providers = useProviderStore(s => s.providers);
  const activeProvider = useProviderStore(s => s.activeProvider);
  const selectedModel = useProviderStore(s => s.selectedModel);
  const models = useProviderStore(s => s.models);
  const validationStatus = useProviderStore(s => s.validationStatus);
  const trustLevel = useProviderStore(s => s.trustLevel);

  // Load existing settings when dialog opens
  useEffect(() => {
    if (!open) return;
    loadExistingSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadExistingSettings() {
    try {
      const settings = await loadSettings();
      const store = useProviderStore.getState();
      store.setActiveProvider((settings.default_provider || '') as ProviderType | '');
      store.setSelectedModel(settings.default_model || '');
      setOllamaEndpoint(settings.ollama_endpoint || 'http://localhost:11434');

      if (settings.trust_level) {
        store.setTrustLevel(settings.trust_level);
      }

      if (settings.providers) {
        for (const [type, cfg] of Object.entries(settings.providers)) {
          store.updateProviderConfig(type as ProviderType, { enabled: cfg.enabled });
        }
      }

      // Check keychain for existing keys
      const keyChecks = (['claude', 'openai', 'gemini'] as ProviderType[]).map(
        async (type) => {
          const exists = await hasApiKey(type);
          if (exists) {
            setKeySaved(prev => ({ ...prev, [type]: true }));
            store.updateProviderConfig(type, { hasValidCredentials: true });
            fetchModels(type);
          }
        },
      );
      await Promise.all(keyChecks);

      // Check Ollama connectivity
      if (settings.ollama_endpoint) {
        fetchModels('ollama');
      }
    } catch {
      // Settings not available — use defaults
    }
  }

  async function fetchModels(type: ProviderType) {
    try {
      const fetchedModels = await listModels(type);
      useProviderStore.getState().setModelsForProvider(type, fetchedModels);
    } catch {
      // Models unavailable — not blocking
    }
  }

  async function persistSettings() {
    try {
      const store = useProviderStore.getState();
      await saveSettings({
        default_provider: store.activeProvider,
        default_model: store.selectedModel,
        ollama_endpoint: ollamaEndpoint,
        trust_level: store.trustLevel,
        providers: Object.fromEntries(
          store.providers.map(p => [
            p.type,
            { enabled: p.hasValidCredentials, endpoint: p.endpoint },
          ]),
        ),
      });
    } catch {
      // Saving failed — state is still updated locally
    }
  }

  const handleValidate = useCallback(
    async (type: ProviderType) => {
      const key =
        type === 'ollama'
          ? ollamaEndpoint
          : keyInputRefs.current[type]?.value ?? '';
      if (!key) {
        setErrors(prev => ({ ...prev, [type]: 'Please enter a value first' }));
        return;
      }

      const store = useProviderStore.getState();
      store.setValidationStatus(type, { loading: true, message: undefined });
      setErrors(prev => ({ ...prev, [type]: '' }));

      try {
        await validateProvider(type, key);
        store.setValidationStatus(type, {
          valid: true,
          loading: false,
          message: 'Valid',
        });
        store.updateProviderConfig(type, { hasValidCredentials: true });

        // Store key securely
        if (type !== 'ollama') {
          await setApiKey(type, key);
          setKeySaved(prev => ({ ...prev, [type]: true }));
          // Clear the input after storing
          if (keyInputRefs.current[type]) {
            keyInputRefs.current[type]!.value = '';
          }
        }

        await fetchModels(type);
      } catch (err) {
        const message = friendlyValidationError(type, err);
        store.setValidationStatus(type, {
          valid: false,
          loading: false,
          message,
        });
        store.updateProviderConfig(type, { hasValidCredentials: false });
      }
    },
    [ollamaEndpoint],
  );

  const handleModelSelect = useCallback(
    (modelId: string) => {
      useProviderStore.getState().setSelectedModel(modelId);
      persistSettings();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSetDefault = useCallback(
    async (type: ProviderType) => {
      const store = useProviderStore.getState();
      store.setActiveProvider(type);

      const providerModels = store.models[type];
      const currentModel = store.selectedModel;
      const modelBelongsToProvider = providerModels?.some(
        m => m.id === currentModel,
      );
      if (!modelBelongsToProvider && providerModels?.length) {
        store.setSelectedModel(providerModels[0].id);
      }

      await persistSettings();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleTrustLevelChange = useCallback(
    (value: string) => {
      useProviderStore.getState().setTrustLevel(value as TrustLevel);
      persistSettings();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- Sub-renders ---

  function renderValidationStatus(type: ProviderType) {
    const status = validationStatus[type];
    if (!status) return null;

    if (status.loading) {
      return (
        <span className="text-[length:var(--text-sm)] text-text-secondary">
          Validating...
        </span>
      );
    }
    if (status.valid) {
      return <Badge variant="success">Valid</Badge>;
    }
    if (status.message) {
      return (
        <span className="text-[length:var(--text-sm)] text-error">
          {status.message}
        </span>
      );
    }
    return null;
  }

  function renderModelSelector(type: ProviderType) {
    let providerModels: Model[] = models[type] ?? [];
    if (providerModels.length === 0) return null;

    const showFilter = type === 'ollama';
    if (showFilter && showOnlyToolCapable) {
      providerModels = providerModels.filter(m => m.supports_tools);
    }

    return (
      <div className="flex flex-col gap-2">
        <span className="text-[length:var(--text-sm)] font-medium uppercase tracking-wider text-text-secondary">
          Model
        </span>
        {showFilter && (
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={showOnlyToolCapable}
              onCheckedChange={checked =>
                setShowOnlyToolCapable(checked === true)
              }
            />
            <span className="text-[length:var(--text-sm)] text-text-secondary">
              Show only tool-capable models
            </span>
          </label>
        )}
        <Select value={selectedModel} onValueChange={handleModelSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {providerModels.map(m => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex items-center gap-2">
                  {m.name}
                  {m.supports_tools && (
                    <Badge variant="success" className="text-[10px]">
                      Tools
                    </Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  function renderDefaultStatus(type: ProviderType) {
    const isDefault = activeProvider === type;
    const hasCredentials = providers.find(
      p => p.type === type,
    )?.hasValidCredentials;

    return (
      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-bg-tertiary p-3">
        <span className="text-[length:var(--text-sm)] text-text-secondary">
          {isDefault ? 'Default provider' : 'Set as default provider'}
        </span>
        {isDefault ? (
          <Badge>Default</Badge>
        ) : (
          <Button
            size="sm"
            disabled={!hasCredentials}
            onClick={() => handleSetDefault(type)}
          >
            Set as Default
          </Button>
        )}
      </div>
    );
  }

  function renderApiKeyTab(type: ApiKeyProvider) {
    const saved = keySaved[type];
    const helpText = saved
      ? 'Key saved. Enter a new key to replace it.'
      : API_KEY_HELP[type];
    const error = errors[type] || '';
    const status = validationStatus[type];

    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <label className="text-[length:var(--text-sm)] font-medium text-text-primary">
            {API_KEY_LABELS[type]}
          </label>
          <div className="flex items-end gap-2">
            <Input
              ref={el => {
                keyInputRefs.current[type] = el;
              }}
              type="password"
              placeholder={API_KEY_PLACEHOLDERS[type]}
              onChange={() => {
                if (errors[type]) {
                  setErrors(prev => ({ ...prev, [type]: '' }));
                }
              }}
              onBlur={() => {
                const key = keyInputRefs.current[type]?.value ?? '';
                if (!key && !keySaved[type]) {
                  setErrors(prev => ({
                    ...prev,
                    [type]: 'API key is required',
                  }));
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={() => handleValidate(type)}
              disabled={status?.loading}
            >
              {status?.loading ? 'Validating...' : 'Validate'}
            </Button>
          </div>
          <span
            className={cn(
              'text-[length:var(--text-sm)]',
              error ? 'text-error' : 'text-text-tertiary',
            )}
          >
            {error || helpText}
          </span>
          <div className="flex min-h-7 items-center gap-2">
            {renderValidationStatus(type)}
          </div>
        </div>

        <Separator />
        {renderModelSelector(type)}
        {renderDefaultStatus(type)}
      </div>
    );
  }

  function renderOllamaTab() {
    const error = errors['ollama'] || '';
    const status = validationStatus['ollama'];

    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <label className="text-[length:var(--text-sm)] font-medium text-text-primary">
            Ollama Endpoint
          </label>
          <div className="flex items-end gap-2">
            <Input
              type="url"
              placeholder="http://localhost:11434"
              value={ollamaEndpoint}
              onChange={e => {
                setOllamaEndpoint(e.target.value);
                if (errors['ollama']) {
                  setErrors(prev => ({ ...prev, ollama: '' }));
                }
              }}
              onBlur={() => {
                if (!ollamaEndpoint) {
                  setErrors(prev => ({
                    ...prev,
                    ollama: 'Endpoint URL is required',
                  }));
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={() => handleValidate('ollama')}
              disabled={status?.loading}
            >
              {status?.loading ? 'Validating...' : 'Validate'}
            </Button>
          </div>
          <span
            className={cn(
              'text-[length:var(--text-sm)]',
              error ? 'text-error' : 'text-text-tertiary',
            )}
          >
            {error || 'URL of your running Ollama instance'}
          </span>
          <div className="flex min-h-7 items-center gap-2">
            {renderValidationStatus('ollama')}
          </div>
        </div>

        <Separator />
        {renderModelSelector('ollama')}
        {renderDefaultStatus('ollama')}
      </div>
    );
  }

  function renderExecutionTab() {
    return (
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <span className="text-[length:var(--text-sm)] font-medium uppercase tracking-wider text-text-secondary">
            Trust Level
          </span>
          <Select value={trustLevel} onValueChange={handleTrustLevelChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="supervised">Supervised</SelectItem>
              <SelectItem value="guided">Guided (Recommended)</SelectItem>
              <SelectItem value="autonomous">Autonomous</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[length:var(--text-sm)] leading-relaxed text-text-tertiary">
            {trustLevel === 'supervised' &&
              'Confirm all tool executions before they run.'}
            {trustLevel === 'guided' &&
              'Confirm only dangerous tools (file writes, shell commands). Safe tools run automatically.'}
            {trustLevel === 'autonomous' &&
              'Execute all tools without confirmation. Use with caution.'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Provider Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="claude">Claude</TabsTrigger>
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="gemini">Gemini</TabsTrigger>
            <TabsTrigger value="ollama">Ollama</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
          </TabsList>

          <TabsContent value="claude">{renderApiKeyTab('claude')}</TabsContent>
          <TabsContent value="openai">{renderApiKeyTab('openai')}</TabsContent>
          <TabsContent value="gemini">{renderApiKeyTab('gemini')}</TabsContent>
          <TabsContent value="ollama">{renderOllamaTab()}</TabsContent>
          <TabsContent value="execution">{renderExecutionTab()}</TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
