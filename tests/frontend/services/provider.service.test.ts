import { expect } from '@open-wc/testing';
import {
  validateProvider,
  listModels,
  loadSettings,
  saveSettings,
  friendlyValidationError,
} from '../../../src/services/provider.service.ts';

function setupFetch(status: number, body: unknown): void {
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ProviderService', () => {
  describe('validateProvider', () => {
    it('returns valid result on success', async () => {
      setupFetch(200, { valid: true });
      const result = await validateProvider('claude', 'sk-ant-test');
      expect(result.valid).to.be.true;
    });

    it('throws on validation failure', async () => {
      setupFetch(401, { error: { code: 'auth_error', message: 'Invalid API key' } });
      try {
        await validateProvider('claude', 'bad-key');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Invalid API key');
      }
    });

    it('throws on network error status', async () => {
      setupFetch(500, { error: { code: 'internal_error', message: 'Server error' } });
      try {
        await validateProvider('claude', 'key');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Server error');
      }
    });
  });

  describe('listModels', () => {
    it('returns models array on success', async () => {
      const models = [
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'claude', max_tokens: 8192 },
      ];
      setupFetch(200, models);
      const result = await listModels('claude');
      expect(result).to.have.length(1);
      expect(result[0].id).to.equal('claude-3-5-sonnet');
    });

    it('throws on error', async () => {
      setupFetch(400, { error: { code: 'invalid_request', message: 'Unsupported provider' } });
      try {
        await listModels('unknown' as any);
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Unsupported provider');
      }
    });
  });

  describe('loadSettings', () => {
    it('returns settings on success', async () => {
      const settings = {
        default_provider: 'claude',
        default_model: 'claude-3-5-sonnet',
        ollama_endpoint: 'http://localhost:11434',
        providers: { claude: { enabled: true }, openai: { enabled: false }, ollama: { enabled: false } },
      };
      setupFetch(200, settings);
      const result = await loadSettings();
      expect(result.default_provider).to.equal('claude');
      expect(result.providers.claude.enabled).to.be.true;
    });
  });

  describe('saveSettings', () => {
    it('sends PUT and returns updated settings', async () => {
      const settings = {
        default_provider: 'openai',
        default_model: 'gpt-4o',
        ollama_endpoint: 'http://localhost:11434',
        providers: { claude: { enabled: true }, openai: { enabled: true }, ollama: { enabled: false } },
      };
      setupFetch(200, settings);
      const result = await saveSettings(settings);
      expect(result.default_provider).to.equal('openai');
    });
  });

  describe('friendlyValidationError', () => {
    it('maps network error to user-friendly message', () => {
      const msg = friendlyValidationError('claude', new Error('Failed to fetch'));
      expect(msg).to.include('Network error');
    });

    it('maps network error for Ollama to connection message', () => {
      const msg = friendlyValidationError('ollama', new Error('Failed to fetch'));
      expect(msg).to.include('Ollama');
    });

    it('maps 401 error to provider-specific hint for Claude', () => {
      const msg = friendlyValidationError('claude', new Error('Invalid API key'));
      expect(msg).to.include('console.anthropic.com');
    });

    it('maps 401 error to provider-specific hint for OpenAI', () => {
      const msg = friendlyValidationError('openai', new Error('Invalid API key'));
      expect(msg).to.include('platform.openai.com');
    });

    it('maps rate limit error', () => {
      const msg = friendlyValidationError('claude', new Error('rate limit exceeded'));
      expect(msg).to.include('wait');
    });

    it('returns raw message for unknown errors', () => {
      const msg = friendlyValidationError('claude', new Error('Something unexpected'));
      expect(msg).to.equal('Something unexpected');
    });

    it('returns fallback for non-Error objects', () => {
      const msg = friendlyValidationError('claude', 'just a string');
      expect(msg).to.equal('Validation failed');
    });
  });
});
