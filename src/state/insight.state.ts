import { Signal } from 'signal-polyfill';
import type { Insight } from '../types/insight.js';

export const insightsState = new Signal.State<Insight[]>([]);

export function addInsight(insight: Insight): void {
  insightsState.set([...insightsState.get(), insight]);
}

export function clearInsightState(): void {
  insightsState.set([]);
}
