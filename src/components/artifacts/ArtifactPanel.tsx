import { useState, useCallback } from 'react';
import { ArtifactList } from './ArtifactList';
import { ArtifactViewer } from './ArtifactViewer';

interface ArtifactPanelProps {
  /** Initial artifact path to display (e.g., from phase graph node click) */
  initialArtifactPath?: string | null;
  /** Initial phase label for the initially selected artifact */
  initialPhase?: string;
  /** Callback to return to phase graph */
  onBack: () => void;
}

export function ArtifactPanel({ initialArtifactPath, initialPhase, onBack }: ArtifactPanelProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(initialArtifactPath ?? null);
  const [selectedPhase, setSelectedPhase] = useState<string | undefined>(initialPhase);

  const handleSelectArtifact = useCallback((artifactPath: string, phase: string) => {
    setSelectedPath(artifactPath);
    setSelectedPhase(phase);
  }, []);

  return (
    <div className="flex h-full">
      {/* Sidebar — fixed 200px width */}
      <div className="w-[200px] shrink-0 overflow-y-auto border-r border-surface-border">
        <ArtifactList
          selectedArtifact={selectedPath}
          onSelectArtifact={handleSelectArtifact}
        />
      </div>

      {/* Content area — fills remaining space */}
      <div className="flex-1 overflow-hidden">
        {selectedPath ? (
          <ArtifactViewer
            artifactPath={selectedPath}
            phase={selectedPhase}
            onBack={onBack}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[length:var(--text-sm)] text-interactive-muted">
              Select an artifact to view its content
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
