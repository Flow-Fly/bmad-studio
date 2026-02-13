export interface ArtifactInfo {
  filename: string;
  phase: string;
  type: 'file' | 'directory';
  modifiedAt: string;
  size: number;
}
