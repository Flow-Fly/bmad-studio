import { expect, fixture, html } from '@open-wc/testing';
import { AppShell } from '../../../src/app-shell.ts';
import {
  clearProject,
  setProjectSuccess,
  setProjectError,
  setProjectLoading,
} from '../../../src/state/project.state.ts';
import type { ProjectData } from '../../../src/types/project.ts';

const mockProject: ProjectData = {
  projectName: 'test-project',
  projectRoot: '/path/to/test-project',
  bmadLoaded: true,
  services: {
    config: true,
    phases: true,
    agents: true,
    status: true,
    artifacts: true,
    watcher: true,
  },
};

// Stub fetch globally for component tests
beforeEach(() => {
  clearProject();
  (globalThis as any).fetch = async () =>
    new Response(
      JSON.stringify({
        default_provider: 'claude',
        default_model: '',
        ollama_endpoint: 'http://localhost:11434',
        providers: {
          claude: { enabled: false },
          openai: { enabled: false },
          ollama: { enabled: false },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
});

afterEach(() => {
  clearProject();
});

describe('AppShell', () => {
  it('renders with default values', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    expect(el).to.exist;
    expect(el).to.be.instanceOf(AppShell);
  });

  it('displays empty state when no project is loaded', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const emptyState = el.shadowRoot!.querySelector('.empty-state');
    expect(emptyState).to.exist;
    const h1 = emptyState!.querySelector('h1');
    expect(h1!.textContent).to.equal('BMAD Studio');
  });

  it('shows Open Project button in empty state', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('.empty-state sl-button');
    expect(button).to.exist;
    expect(button!.textContent).to.include('Open Project');
  });

  it('shows loading state while project loads', async () => {
    setProjectLoading();
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const loadingState = el.shadowRoot!.querySelector('.loading-state');
    expect(loadingState).to.exist;
    const spinner = loadingState!.querySelector('sl-spinner');
    expect(spinner).to.exist;
  });

  it('shows error state when project open fails', async () => {
    setProjectError('No BMAD configuration found', 'bmad_not_found');
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const errorState = el.shadowRoot!.querySelector('.error-state');
    expect(errorState).to.exist;
    const alert = errorState!.querySelector('sl-alert');
    expect(alert).to.exist;
  });

  it('shows loaded state with project name', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const loadedState = el.shadowRoot!.querySelector('.loaded-state');
    expect(loadedState).to.exist;
    // Verify new layout: loaded-state contains activity-bar and .main-area
    const activityBar = loadedState!.querySelector('activity-bar');
    expect(activityBar).to.exist;
    const mainArea = loadedState!.querySelector('.main-area');
    expect(mainArea).to.exist;
    const projectName = mainArea!.querySelector('.project-name');
    expect(projectName!.textContent).to.equal('test-project');
  });

  it('shows BMAD badge when bmad services available', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('.bmad-badge');
    expect(badge).to.exist;
    expect(badge!.textContent).to.equal('BMAD');
  });

  it('hides BMAD badge when bmad not loaded', async () => {
    setProjectSuccess({ ...mockProject, bmadLoaded: false });
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('.bmad-badge');
    expect(badge).to.be.null;
  });

  it('contains settings icon button in header when project loaded', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const gearButton = el.shadowRoot!.querySelector('.header-actions sl-icon-button[name="gear"]');
    expect(gearButton).to.exist;
  });

  it('contains provider-settings component', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const settings = el.shadowRoot!.querySelector('provider-settings');
    expect(settings).to.exist;
  });

  it('shows folder-open button in header when project is loaded', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const folderButton = el.shadowRoot!.querySelector('.header-actions sl-icon-button[name="folder2-open"]');
    expect(folderButton).to.exist;
  });

  it('hides folder-open button when no project loaded', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const folderButton = el.shadowRoot!.querySelector('sl-icon-button[name="folder2-open"]');
    expect(folderButton).to.be.null;
  });

  it('error state shows Select Different Folder button', async () => {
    setProjectError('No BMAD configuration found', 'bmad_not_found');
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('.error-actions sl-button');
    expect(button).to.exist;
    expect(button!.textContent).to.include('Select Different Folder');
  });

  it('renders phase-graph-container when project is loaded', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const phaseGraph = el.shadowRoot!.querySelector('phase-graph-container');
    expect(phaseGraph).to.exist;
  });

  it('does not render phase-graph-container when no project loaded', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const phaseGraph = el.shadowRoot!.querySelector('phase-graph-container');
    expect(phaseGraph).to.be.null;
  });

  it('does not render workflow-status-display when project is loaded', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const workflowDisplay = el.shadowRoot!.querySelector('workflow-status-display');
    expect(workflowDisplay).to.be.null;
  });

  // New layout tests
  it('loaded state renders activity-bar component', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const activityBar = el.shadowRoot!.querySelector('.loaded-state activity-bar');
    expect(activityBar).to.exist;
  });

  it('loaded state renders header inside main-area', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('.main-area .header');
    expect(header).to.exist;
  });

  it('default active section is graph and phase-graph-container is rendered', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    expect(el._activeSection).to.equal('graph');
    const phaseGraph = el.shadowRoot!.querySelector('.content-area phase-graph-container');
    expect(phaseGraph).to.exist;
  });

  it('section-change event switches content to chat placeholder', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    // Dispatch section-change event from activity-bar
    const activityBar = el.shadowRoot!.querySelector('activity-bar')!;
    activityBar.dispatchEvent(new CustomEvent('section-change', {
      detail: { section: 'chat' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    expect(el._activeSection).to.equal('chat');
    const chatPanel = el.shadowRoot!.querySelector('.content-area chat-panel');
    expect(chatPanel).to.exist;
  });

  it('section-change event switches content to artifacts placeholder', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    const activityBar = el.shadowRoot!.querySelector('activity-bar')!;
    activityBar.dispatchEvent(new CustomEvent('section-change', {
      detail: { section: 'artifacts' },
      bubbles: true,
      composed: true,
    }));
    await el.updateComplete;

    expect(el._activeSection).to.equal('artifacts');
    const placeholder = el.shadowRoot!.querySelector('.content-area .placeholder');
    expect(placeholder).to.exist;
    expect(placeholder!.textContent).to.include('Artifacts panel');
  });

  // Keyboard shortcut tests
  it('Cmd+1 sets section to graph', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    // First switch to chat
    el._activeSection = 'chat';
    await el.updateComplete;

    // Press Cmd+1
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true }));
    await el.updateComplete;

    expect(el._activeSection).to.equal('graph');
  });

  it('Cmd+2 sets section to chat', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', metaKey: true }));
    await el.updateComplete;

    expect(el._activeSection).to.equal('chat');
    const chatPanel = el.shadowRoot!.querySelector('.content-area chat-panel');
    expect(chatPanel).to.exist;
  });

  it('Cmd+3 sets section to artifacts', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', metaKey: true }));
    await el.updateComplete;

    expect(el._activeSection).to.equal('artifacts');
    const placeholder = el.shadowRoot!.querySelector('.content-area .placeholder');
    expect(placeholder).to.exist;
    expect(placeholder!.textContent).to.include('Artifacts panel');
  });

  it('toolbar buttons are in header-actions not in a floating toolbar', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    // No floating toolbar
    const toolbar = el.shadowRoot!.querySelector('.toolbar');
    expect(toolbar).to.be.null;
    // Buttons in header-actions
    const headerActions = el.shadowRoot!.querySelector('.header-actions');
    expect(headerActions).to.exist;
    const buttons = headerActions!.querySelectorAll('sl-icon-button');
    expect(buttons.length).to.equal(2);
  });

  // H1: Keyboard shortcuts ignored when no project loaded
  it('keyboard shortcuts do nothing when no project loaded', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', metaKey: true }));
    await el.updateComplete;

    // Should remain on default section and still show empty state
    expect(el._activeSection).to.equal('graph');
    const emptyState = el.shadowRoot!.querySelector('.empty-state');
    expect(emptyState).to.exist;
  });

  // H2: phase-graph-container has tabindex for focus management
  it('phase-graph-container has tabindex="-1" for keyboard focus', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    const phaseGraph = el.shadowRoot!.querySelector('phase-graph-container');
    expect(phaseGraph).to.exist;
    expect(phaseGraph!.getAttribute('tabindex')).to.equal('-1');
  });

  // Keyboard listener cleanup
  it('removes keyboard listener on disconnect', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;

    el.remove();

    const sectionBefore = el._activeSection;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', metaKey: true }));
    expect(el._activeSection).to.equal(sectionBefore);
  });
});
