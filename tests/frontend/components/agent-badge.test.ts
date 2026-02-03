import { expect, fixture, html } from '@open-wc/testing';
import '../../../src/components/core/navigation/agent-badge.ts';
import {
  agentsState,
  activeAgentId,
  agentConversations,
  clearAgentState,
  setActiveAgent,
} from '../../../src/state/agent.state.ts';
import { activeConversations, setConversation, clearChatState } from '../../../src/state/chat.state.ts';
import type { Agent } from '../../../src/types/agent.ts';
import type { Conversation } from '../../../src/types/conversation.ts';

const mockAgents: Agent[] = [
  {
    id: 'analyst',
    name: 'Analyst',
    title: 'Business Analyst',
    icon: 'brain',
    frontmatter_name: 'Analyst Agent',
    description: 'Analyzes business requirements',
    persona: { role: 'analyst', identity: 'Expert', communication_style: 'professional' },
    menu_items: [],
    workflows: [],
  },
  {
    id: 'dev',
    name: 'Dev',
    title: 'Developer',
    icon: 'code',
    frontmatter_name: 'Dev Agent',
    description: 'Writes code',
    persona: { role: 'developer', identity: 'Senior', communication_style: 'technical' },
    menu_items: [],
    workflows: [],
  },
  {
    id: 'pm',
    name: 'PM',
    title: 'Product Manager',
    icon: 'clipboard-list',
    frontmatter_name: 'PM Agent',
    description: 'Manages product',
    persona: { role: 'pm', identity: 'Expert PM', communication_style: 'concise' },
    menu_items: [],
    workflows: [],
  },
];

beforeEach(() => {
  clearAgentState();
  clearChatState();
});

afterEach(() => {
  clearAgentState();
  clearChatState();
});

describe('AgentBadge', () => {
  it('renders current agent name and icon', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    const name = el.shadowRoot!.querySelector('.badge-name');
    expect(name).to.exist;
    expect(name!.textContent).to.equal('Analyst');

    const icon = el.shadowRoot!.querySelector('.badge-icon');
    expect(icon).to.exist;

    const title = el.shadowRoot!.querySelector('.badge-title');
    expect(title).to.exist;
    expect(title!.textContent).to.equal('Business Analyst');
  });

  it('shows fallback "Chat" when no agents loaded', async () => {
    agentsState.set([]);
    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    const name = el.shadowRoot!.querySelector('.badge-name');
    expect(name).to.exist;
    expect(name!.textContent).to.equal('Chat');

    // No dropdown button when no agents
    const badge = el.shadowRoot!.querySelector('.badge');
    expect(badge).to.not.exist;
  });

  it('click toggles dropdown visibility', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Dropdown should not be visible initially
    let dropdown = el.shadowRoot!.querySelector('.dropdown');
    expect(dropdown).to.not.exist;

    // Click badge to open
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    dropdown = el.shadowRoot!.querySelector('.dropdown');
    expect(dropdown).to.exist;

    // Click again to close
    badge.click();
    await el.updateComplete;

    dropdown = el.shadowRoot!.querySelector('.dropdown');
    expect(dropdown).to.not.exist;
  });

  it('dropdown lists all agents from state', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.agent-item');
    expect(items.length).to.equal(3);

    const names = Array.from(items).map(i => i.querySelector('.agent-item-name')!.textContent);
    expect(names).to.deep.equal(['Analyst', 'Dev', 'PM']);
  });

  it('active agent is visually highlighted with aria-selected', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('dev');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.agent-item');
    // Analyst (index 0) should not be selected
    expect(items[0].getAttribute('aria-selected')).to.equal('false');
    // Dev (index 1) should be selected
    expect(items[1].getAttribute('aria-selected')).to.equal('true');
  });

  it('agent with active conversation shows filled dot', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    // Create a conversation for the analyst agent
    const conv: Conversation = {
      id: 'conv-analyst',
      messages: [],
      model: 'claude-3',
      provider: 'claude',
      createdAt: Date.now(),
      agentId: 'analyst',
    };
    setConversation(conv);
    // Map agent to conversation
    const map = new Map(agentConversations.get());
    map.set('analyst', 'conv-analyst');
    agentConversations.set(map);

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.agent-item');
    const analystDot = items[0].querySelector('.status-dot');
    expect(analystDot!.classList.contains('status-dot--active')).to.be.true;
  });

  it('agent without active conversation shows empty dot', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.agent-item');
    const devDot = items[1].querySelector('.status-dot');
    expect(devDot!.classList.contains('status-dot--inactive')).to.be.true;
  });

  it('ArrowDown moves focus to next agent', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown with ArrowDown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.focus();
    badge.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));

    // Dropdown should be open
    const dropdown = el.shadowRoot!.querySelector('.dropdown');
    expect(dropdown).to.exist;
  });

  it('ArrowUp moves focus to previous agent', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    const dropdown = el.shadowRoot!.querySelector('.dropdown') as HTMLElement;
    // Navigate down to index 1
    dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    // Navigate up back to index 0
    dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;

    // Dropdown should still be open
    expect(el.shadowRoot!.querySelector('.dropdown')).to.exist;
  });

  it('Enter selects focused agent', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    let selectedAgentId = '';
    el.addEventListener('agent-change', ((e: CustomEvent) => {
      selectedAgentId = e.detail.agentId;
    }) as EventListener);

    // Open dropdown and focus first item
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.focus();
    badge.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));

    // Press ArrowDown to move to second item (dev)
    const dropdown = el.shadowRoot!.querySelector('.dropdown') as HTMLElement;
    dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));

    // Press Enter to select
    dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;

    expect(selectedAgentId).to.equal('dev');
    expect(activeAgentId.get()).to.equal('dev');
  });

  it('Escape closes dropdown', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.dropdown')).to.exist;

    // Press Escape
    const dropdown = el.shadowRoot!.querySelector('.dropdown') as HTMLElement;
    dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.dropdown')).to.not.exist;
  });

  it('dispatches agent-change event on selection', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    let eventDetail: any = null;
    el.addEventListener('agent-change', ((e: CustomEvent) => {
      eventDetail = e.detail;
    }) as EventListener);

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    // Click the dev agent item
    const items = el.shadowRoot!.querySelectorAll('.agent-item') as NodeListOf<HTMLButtonElement>;
    items[1].click();
    await el.updateComplete;

    expect(eventDetail).to.not.be.null;
    expect(eventDetail.agentId).to.equal('dev');
  });

  it('has correct ARIA attributes on badge', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    expect(badge.getAttribute('role')).to.equal('combobox');
    expect(badge.getAttribute('aria-expanded')).to.equal('false');
    expect(badge.getAttribute('aria-haspopup')).to.equal('listbox');
    expect(badge.getAttribute('aria-label')).to.equal('Select BMAD agent');
  });

  it('has correct ARIA attributes on dropdown and items', async () => {
    agentsState.set(mockAgents);
    setActiveAgent('analyst');

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    // Open dropdown
    const badge = el.shadowRoot!.querySelector('.badge') as HTMLButtonElement;
    badge.click();
    await el.updateComplete;

    expect(badge.getAttribute('aria-expanded')).to.equal('true');

    const dropdown = el.shadowRoot!.querySelector('.dropdown');
    expect(dropdown!.getAttribute('role')).to.equal('listbox');
    expect(dropdown!.getAttribute('aria-label')).to.equal('Select BMAD agent');

    const items = el.shadowRoot!.querySelectorAll('.agent-item');
    items.forEach(item => {
      expect(item.getAttribute('role')).to.equal('option');
    });
  });

  it('shows Chat badge name when agents loaded but no active agent', async () => {
    agentsState.set(mockAgents);
    // Do not set active agent

    const el = await fixture(html`<agent-badge></agent-badge>`);
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('.badge');
    expect(badge).to.exist;

    const name = el.shadowRoot!.querySelector('.badge-name');
    expect(name!.textContent).to.equal('Chat');
  });
});
