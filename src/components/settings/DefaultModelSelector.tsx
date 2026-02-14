import { useCallback } from 'react';
import { useOpenCodeStore } from '../../stores/opencode.store';
import { useSettingsStore } from '../../stores/settings.store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export function DefaultModelSelector() {
  const models = useOpenCodeStore((s) => s.models);
  const defaultProvider = useOpenCodeStore((s) => s.defaultProvider);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const currentModel = settings?.default_model || '';
  const currentProvider = settings?.default_provider || defaultProvider || '';

  const handleModelChange = useCallback(
    (value: string) => {
      // Try to infer provider from model name
      let provider = currentProvider;
      const lowerModel = value.toLowerCase();
      if (lowerModel.includes('claude')) {
        provider = 'anthropic';
      } else if (lowerModel.includes('gpt') || lowerModel.includes('o1') || lowerModel.includes('o3')) {
        provider = 'openai';
      } else if (lowerModel.includes('gemini')) {
        provider = 'gemini';
      } else if (defaultProvider) {
        provider = defaultProvider;
      }

      updateSettings({
        default_provider: provider,
        default_model: value,
      });
    },
    [currentProvider, defaultProvider, updateSettings]
  );

  // Don't render if no models available
  if (models.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-overlay p-4 space-y-3">
      <div>
        <h3 className="text-[length:var(--text-md)] font-medium text-interactive-default">
          Default Model
        </h3>
        <p className="mt-0.5 text-[length:var(--text-sm)] text-interactive-muted">
          Select the default model for new AI sessions
        </p>
      </div>

      <div className="max-w-xs">
        <Select value={currentModel} onValueChange={handleModelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {currentProvider && (
        <p className="text-[length:var(--text-sm)] text-interactive-muted">
          Provider:{' '}
          <span className="font-medium text-interactive-default capitalize">
            {currentProvider}
          </span>
        </p>
      )}
    </div>
  );
}
