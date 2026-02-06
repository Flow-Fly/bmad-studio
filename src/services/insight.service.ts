import type { Insight } from '../types/insight.js';
import { addInsight, setInsights, updateInsightInState, removeInsight } from '../state/insight.state.js';

const API_BASE = 'http://localhost:3008/api/v1';

export async function createInsight(projectId: string, insight: Insight): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insight),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to create insight: ${errorText}`);
  }

  addInsight(insight);
}

export async function fetchInsights(projectId: string): Promise<Insight[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch insights: ${errorText}`);
  }

  const insights: Insight[] = await response.json();
  setInsights(insights);
  return insights;
}

export async function updateInsight(projectId: string, insight: Insight): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights/${insight.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insight),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to update insight: ${errorText}`);
  }

  updateInsightInState(insight);
}

export async function markInsightUsed(projectId: string, insight: Insight): Promise<void> {
  const updated: Insight = {
    ...insight,
    status: insight.status === 'fresh' ? 'used' : insight.status,
    used_in_count: insight.used_in_count + 1,
  };
  await updateInsight(projectId, updated);
}

export interface CompactConversationRequest {
  messages: { role: string; content: string }[];
  provider: string;
  model: string;
  api_key: string;
  source_agent: string;
  highlight_colors_used: string[];
}

export async function compactConversation(
  projectId: string,
  request: CompactConversationRequest,
): Promise<Insight> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights/compact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to compact conversation: ${errorText}`);
  }

  const insight: Insight = await response.json();
  addInsight(insight);
  return insight;
}

export async function deleteInsight(projectId: string, insightId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights/${insightId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to delete insight: ${errorText}`);
  }

  removeInsight(insightId);
}
