import { expect, fixture, html } from '@open-wc/testing';
import { AppShell } from '../../../src/app-shell.ts';
import {
  projectState,
  projectLoadingState,
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
    const projectName = loadedState!.querySelector('.project-name');
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

  it('contains settings icon button', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const gearButton = el.shadowRoot!.querySelector('sl-icon-button[name="gear"]');
    expect(gearButton).to.exist;
  });

  it('contains provider-settings component', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const settings = el.shadowRoot!.querySelector('provider-settings');
    expect(settings).to.exist;
  });

  it('shows folder-open button in toolbar when project is loaded', async () => {
    setProjectSuccess(mockProject);
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const folderButton = el.shadowRoot!.querySelector('sl-icon-button[name="folder-open"]');
    expect(folderButton).to.exist;
  });

  it('hides folder-open button when no project loaded', async () => {
    const el = await fixture<AppShell>(html`<app-shell></app-shell>`);
    await el.updateComplete;
    const folderButton = el.shadowRoot!.querySelector('sl-icon-button[name="folder-open"]');
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
});
