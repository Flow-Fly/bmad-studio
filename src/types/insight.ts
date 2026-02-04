export type InsightStatus = 'fresh' | 'used' | 'archived';

// Uses snake_case keys to match Go backend JSON tags for wire compatibility.
export interface Insight {
  id: string;
  title: string;
  origin_context: string;
  extracted_idea: string;
  tags: string[];
  highlight_colors_used: string[];
  created_at: string;
  source_agent: string;
  status: InsightStatus;
  used_in_count: number;
}
