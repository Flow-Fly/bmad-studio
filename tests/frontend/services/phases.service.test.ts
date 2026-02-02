import { expect } from '@open-wc/testing';
import { loadPhases } from '../../../src/services/phases.service.ts';
import {
  phasesState,
  phasesLoadingState,
  clearPhasesState,
} from '../../../src/state/phases.state.ts';
import type { PhasesResponse } from '../../../src/types/phases.ts';

function setupFetch(status: number, body: unknown): void {
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

const originalFetch = globalThis.fetch;

const mockPhasesResponse: PhasesResponse = {
  method_name: 'greenfield',
  track: 'bmm',
  field_type: 'software',
  description: 'Test method',
  phases: [
    {
      phase: 1,
      name: 'Analysis',
      required: true,
      optional: false,
      note: null,
      workflows: [
        {
          id: 'create-product-brief',
          exec: null,
          required: true,
          optional: false,
          conditional: null,
          condition_type: null,
          agent: 'analyst',
          command: null,
          output: null,
          note: null,
          included_by: null,
          purpose: 'Product brief creation',
        },
      ],
    },
  ],
};

beforeEach(() => {
  clearPhasesState();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearPhasesState();
});

describe('PhasesService', () => {
  describe('loadPhases', () => {
    it('sets loading state then updates phases state on success', async () => {
      setupFetch(200, mockPhasesResponse);

      await loadPhases();

      const state = phasesState.get();
      expect(state).to.not.be.null;
      expect(state!.method_name).to.equal('greenfield');
      expect(state!.phases).to.have.length(1);
      expect(state!.phases[0].name).to.equal('Analysis');

      const loadState = phasesLoadingState.get();
      expect(loadState.status).to.equal('success');
    });

    it('sets error state on API failure', async () => {
      setupFetch(500, {
        error: { code: 'internal_error', message: 'Internal server error' },
      });

      await loadPhases();

      expect(phasesState.get()).to.be.null;
      const loadState = phasesLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.include('Internal server error');
    });

    it('sets error state on network failure', async () => {
      (globalThis as any).fetch = async () => {
        throw new Error('Failed to fetch');
      };

      await loadPhases();

      expect(phasesState.get()).to.be.null;
      const loadState = phasesLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.include('Failed to fetch');
    });

    it('does not crash when error has no message', async () => {
      (globalThis as any).fetch = async () => {
        throw 'string error';
      };

      await loadPhases();

      const loadState = phasesLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.equal('Failed to load phase definitions');
    });
  });
});
