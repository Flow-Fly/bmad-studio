export type InsightStatus = 'fresh' | 'used' | 'archived';

export interface Insight {
  id: string;
  title: string;
  originContext: string;
  extractedIdea: string;
  tags: string[];
  highlightColorsUsed: string[];
  createdAt: string;
  sourceAgent: string;
  status: InsightStatus;
  usedInCount: number;
}
