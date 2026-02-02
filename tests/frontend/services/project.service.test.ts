import { expect } from '@open-wc/testing';
import { openProject, loadBmadConfig, loadBmadStatus } from '../../../src/services/project.service.ts';
import { projectState, projectLoadingState, clearProject } from '../../../src/state/project.state.ts';

function setupFetch(status: number, body: unknown): void {
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  clearProject();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearProject();
});

describe('ProjectService', () => {
  describe('openProject', () => {
    it('sets loading state then success on valid project', async () => {
      const response = {
        project_name: 'test-project',
        project_root: '/path/to/test-project',
        bmad_loaded: true,
        services: {
          config: true,
          phases: true,
          agents: true,
          status: true,
          artifacts: true,
          watcher: true,
        },
      };
      setupFetch(200, response);

      await openProject('/path/to/test-project');

      const project = projectState.get();
      expect(project).to.not.be.null;
      expect(project!.projectName).to.equal('test-project');
      expect(project!.projectRoot).to.equal('/path/to/test-project');
      expect(project!.bmadLoaded).to.be.true;
      expect(project!.services.config).to.be.true;

      const loadState = projectLoadingState.get();
      expect(loadState.status).to.equal('success');
    });

    it('sets error state when BMAD not found', async () => {
      setupFetch(503, {
        error: {
          code: 'bmad_not_found',
          message: 'No BMAD configuration found in the selected folder.',
        },
      });

      await openProject('/path/without/bmad');

      const project = projectState.get();
      expect(project).to.be.null;

      const loadState = projectLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.include('No BMAD configuration found');
    });

    it('sets error state when config is malformed', async () => {
      setupFetch(422, {
        error: {
          code: 'bmad_config_invalid',
          message: 'Failed to parse BMAD configuration: invalid YAML',
        },
      });

      await openProject('/path/with/bad/config');

      const loadState = projectLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.include('Failed to parse');
    });

    it('sets error state on network failure', async () => {
      (globalThis as any).fetch = async () => {
        throw new Error('Failed to fetch');
      };

      await openProject('/any/path');

      const loadState = projectLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.include('Failed to fetch');
    });
  });

  describe('loadBmadConfig', () => {
    it('returns config data on success', async () => {
      const config = {
        project_name: 'my-project',
        project_root: '/my/project',
        bmad_loaded: true,
        services: { config: true, phases: true, agents: true, status: true, artifacts: true, watcher: true },
      };
      setupFetch(200, config);

      const result = await loadBmadConfig();
      expect(result.project_name).to.equal('my-project');
    });

    it('throws when BMAD not loaded', async () => {
      setupFetch(503, {
        error: { code: 'bmad_not_installed', message: 'BMAD configuration not loaded.' },
      });

      try {
        await loadBmadConfig();
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as Error).message).to.include('BMAD configuration not loaded');
      }
    });
  });

  describe('loadBmadStatus', () => {
    it('returns status data on success', async () => {
      const status = { workflow_statuses: {} };
      setupFetch(200, status);

      const result = await loadBmadStatus();
      expect(result).to.deep.equal(status);
    });
  });
});
