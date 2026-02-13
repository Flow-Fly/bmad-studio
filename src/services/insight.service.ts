import { apiFetch, API_BASE } from './api.service';
import type { Insight } from '../types/insight';
import { useInsightStore } from '../stores/insight.store';

export async function createInsight(projectId: string, insight: Insight): Promise<void> {
  await apiFetch<Insight>(`${API_BASE}/projects/${projectId}/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insight),
  });
  useInsightStore.getState().addInsight(insight);
}

export async function fetchInsights(projectId: string): Promise<Insight[]> {
  const insights = await apiFetch<Insight[]>(`${API_BASE}/projects/${projectId}/insights`);
  useInsightStore.getState().setInsights(insights);
  return insights;
}

export async function updateInsight(projectId: string, insight: Insight): Promise<void> {
  await apiFetch<Insight>(`${API_BASE}/projects/${projectId}/insights/${insight.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(insight),
  });
  useInsightStore.getState().updateInsight(insight);
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
  highlighted_sections?: { color: string; text: string; message_role: string }[];
}

export async function compactConversation(
  projectId: string,
  request: CompactConversationRequest,
): Promise<Insight> {
  const insight = await apiFetch<Insight>(`${API_BASE}/projects/${projectId}/insights/compact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  useInsightStore.getState().addInsight(insight);
  return insight;
}

export async function deleteInsight(projectId: string, insightId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/insights/${insightId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete insight (${response.status})`);
  }
  useInsightStore.getState().removeInsight(insightId);
}
