import { expect } from '@open-wc/testing';
import { on } from '../../../src/services/websocket.service.ts';
import { loadWorkflowStatus } from '../../../src/services/workflow.service.ts';
import {
  workflowState,
  workflowLoadingState,
  clearWorkflowState,
} from '../../../src/state/workflow.state.ts';

function setupFetch(status: number, body: unknown): void {
  (globalThis as any).fetch = async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  clearWorkflowState();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearWorkflowState();
});

describe('WebSocket workflow integration', () => {
  it('websocketService.on returns an unsubscribe function', () => {
    const unsub = on('workflow:status-changed', () => {});
    expect(unsub).to.be.a('function');
    unsub();
  });

  it('loadWorkflowStatus updates state when called (simulating WS handler)', async () => {
    const mockStatus = {
      current_phase: 1,
      current_phase_name: 'Analysis',
      phase_completion: [],
      workflow_statuses: {},
    };
    setupFetch(200, mockStatus);

    await loadWorkflowStatus();

    expect(workflowState.get()).to.not.be.null;
    expect(workflowState.get()!.current_phase).to.equal(1);
    expect(workflowLoadingState.get().status).to.equal('idle');
  });
});
