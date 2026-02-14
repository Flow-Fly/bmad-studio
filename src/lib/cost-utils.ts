/**
 * Cost tracking utilities for OpenCode session usage.
 *
 * Provides pricing data for known models, cost calculation from token counts,
 * and formatting helpers for currency and token display.
 */

/** Per-model pricing in USD per 1M tokens. */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * Static pricing map for known models.
 *
 * Prices are best-known public pricing at time of implementation.
 * Unknown models fall back to showing tokens only (no cost estimate).
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-20250514': { inputPer1M: 3, outputPer1M: 15 },
  'claude-opus-4-20250514': { inputPer1M: 15, outputPer1M: 75 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3, outputPer1M: 15 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4 },
  // OpenAI
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'o3': { inputPer1M: 10, outputPer1M: 40 },
  'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  'o4-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  // Google
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
};

/**
 * Calculates estimated cost in USD from token usage and model ID.
 * Returns null if the model is unknown (no pricing data available).
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return null;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

/**
 * Formats a USD cost for display.
 * Shows two decimal places for costs >= $0.01, four for smaller amounts.
 *
 * @example formatCost(1.5)    // "$1.50"
 * @example formatCost(0.05)   // "$0.05"
 * @example formatCost(0.003)  // "$0.0030"
 */
export function formatCost(usd: number): string {
  if (usd >= 0.01) {
    return `$${usd.toFixed(2)}`;
  }
  return `$${usd.toFixed(4)}`;
}

/**
 * Formats a token count for compact display.
 *
 * @example formatTokenCount(500)      // "500"
 * @example formatTokenCount(1200)     // "1.2k"
 * @example formatTokenCount(15800)    // "15.8k"
 * @example formatTokenCount(1200000)  // "1.2M"
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return `${count}`;
}
