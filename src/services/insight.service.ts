import type { Insight } from '../types/insight.js';
import { addInsight } from '../state/insight.state.js';

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
