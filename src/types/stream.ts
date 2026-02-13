export interface Stream {
  name: string;
  project: string;
  status: 'active' | 'archived';
  type: 'full';
  phase?: string;
  branch?: string;
  worktree?: string;
  outcome?: 'merged' | 'abandoned';
  createdAt: string;
  updatedAt: string;
}
