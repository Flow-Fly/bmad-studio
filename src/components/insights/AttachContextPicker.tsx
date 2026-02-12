import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { useInsightStore } from '../../stores/insight.store';
import { fetchProjectFiles, fetchFileContent } from '../../services/file.service';
import { injectContext } from '../../services/chat.service';
import { markInsightUsed } from '../../services/insight.service';
import type { Insight } from '../../types/insight';
import type { FileEntry } from '../../types/file';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

const MAX_UPLOAD_SIZE = 1_048_576;

interface SelectedItem {
  type: 'insight' | 'file' | 'upload';
  id: string;
  label: string;
  content: string;
  costPercent: number;
}

interface UploadedFile {
  name: string;
  content: string;
  size: number;
}

function estimateCostPercent(text: string, contextWindowSize: number): number {
  if (!text || contextWindowSize <= 0) return 0;
  return Math.ceil(((text.length / 4) / contextWindowSize) * 100);
}

interface AttachContextPickerProps {
  open: boolean;
  conversationId: string;
  projectId: string;
  currentContextPercent: number;
  contextWindowSize: number;
  preSelectedInsightId?: string;
  onClose: () => void;
  onContextAttached?: () => void;
}

export function AttachContextPicker({
  open,
  conversationId,
  projectId,
  currentContextPercent,
  contextWindowSize,
  preSelectedInsightId = '',
  onClose,
  onContextAttached,
}: AttachContextPickerProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'files' | 'upload'>(
    'insights',
  );
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const insights = useInsightStore(s => s.insights);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    setSelectedItems([]);
    setUploadedFiles([]);
    setSearchQuery('');
    setDragOver(false);
    setActiveTab('insights');

    // Pre-select insight if requested
    if (preSelectedInsightId) {
      const insight = insights.find(i => i.id === preSelectedInsightId);
      if (insight) {
        const content = `${insight.origin_context}\n\n${insight.extracted_idea}`;
        setSelectedItems([
          {
            type: 'insight',
            id: insight.id,
            label: insight.title,
            content,
            costPercent: estimateCostPercent(content, contextWindowSize),
          },
        ]);
      }
    }
  }, [open, preSelectedInsightId, insights, contextWindowSize]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const loadFiles = useCallback(async () => {
    if (!projectId) return;
    try {
      const fetched = await fetchProjectFiles(projectId);
      setFiles(fetched);
      setFilesLoaded(true);
    } catch (err) {
      console.warn(
        'Failed to load project files:',
        err instanceof Error ? err.message : err,
      );
      setFiles([]);
      setFilesLoaded(true);
    }
  }, [projectId]);

  const handleTabChange = useCallback(
    (tab: 'insights' | 'files' | 'upload') => {
      setActiveTab(tab);
      if (tab === 'files' && !filesLoaded) {
        loadFiles();
      }
    },
    [filesLoaded, loadFiles],
  );

  const isSelected = useCallback(
    (type: string, id: string) =>
      selectedItems.some(s => s.type === type && s.id === id),
    [selectedItems],
  );

  const toggleInsight = useCallback(
    (insight: Insight) => {
      if (isSelected('insight', insight.id)) {
        setSelectedItems(prev =>
          prev.filter(s => !(s.type === 'insight' && s.id === insight.id)),
        );
      } else {
        const content = `${insight.origin_context}\n\n${insight.extracted_idea}`;
        setSelectedItems(prev => [
          ...prev,
          {
            type: 'insight',
            id: insight.id,
            label: insight.title,
            content,
            costPercent: estimateCostPercent(content, contextWindowSize),
          },
        ]);
      }
    },
    [isSelected, contextWindowSize],
  );

  const toggleFile = useCallback(
    async (file: FileEntry) => {
      if (isSelected('file', file.path)) {
        setSelectedItems(prev =>
          prev.filter(s => !(s.type === 'file' && s.id === file.path)),
        );
        return;
      }
      try {
        const content = await fetchFileContent(projectId, file.path);
        setSelectedItems(prev => [
          ...prev,
          {
            type: 'file',
            id: file.path,
            label: file.name,
            content,
            costPercent: estimateCostPercent(content, contextWindowSize),
          },
        ]);
      } catch (err) {
        console.warn(
          'Failed to fetch file content:',
          err instanceof Error ? err.message : err,
        );
      }
    },
    [isSelected, projectId, contextWindowSize],
  );

  const readUploadedFiles = useCallback(
    (fileList: FileList) => {
      for (const file of Array.from(fileList)) {
        if (file.size > MAX_UPLOAD_SIZE) {
          console.warn(`File "${file.name}" exceeds 1MB limit, skipping.`);
          continue;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          const uploaded: UploadedFile = {
            name: file.name,
            content,
            size: file.size,
          };
          setUploadedFiles(prev => [...prev, uploaded]);
          setSelectedItems(prev => [
            ...prev,
            {
              type: 'upload',
              id: `upload-${file.name}-${Date.now()}`,
              label: file.name,
              content,
              costPercent: estimateCostPercent(content, contextWindowSize),
            },
          ]);
        };
        reader.readAsText(file);
      }
    },
    [contextWindowSize],
  );

  const removeUpload = useCallback((index: number) => {
    setUploadedFiles(prev => {
      const file = prev[index];
      if (file) {
        setSelectedItems(items =>
          items.filter(s => !(s.type === 'upload' && s.label === file.name)),
        );
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const totalCost = selectedItems.reduce((sum, item) => sum + item.costPercent, 0);
  const projected = currentContextPercent + totalCost;
  const showWarning = projected > 80;

  const handleAttach = useCallback(async () => {
    for (const item of selectedItems) {
      injectContext(conversationId, item.content, item.label);

      if (item.type === 'insight') {
        const insight = insights.find(i => i.id === item.id);
        if (insight && projectId) {
          try {
            await markInsightUsed(projectId, insight);
          } catch (err) {
            console.warn(
              'Failed to mark insight used:',
              err instanceof Error ? err.message : err,
            );
          }
        }
      }
    }

    onContextAttached?.();
    onClose();
  }, [selectedItems, conversationId, insights, projectId, onContextAttached, onClose]);

  // Filter insights by search
  const filteredInsights = searchQuery.trim()
    ? insights.filter(
        i =>
          i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          i.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
          i.extracted_idea.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : insights;

  if (!open) return null;

  const tabClass = (tab: string) =>
    cn(
      'cursor-pointer border-b-2 border-transparent bg-transparent px-3 py-2 text-[length:var(--text-sm)] text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
      activeTab === tab && 'border-b-accent text-accent',
    );

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={e => {
        if ((e.target as HTMLElement).classList.contains('fixed')) onClose();
      }}
    >
      <div
        className="flex max-h-[80vh] w-[min(600px,90vw)] flex-col rounded-[var(--radius-lg)] border border-border-primary bg-bg-primary shadow-lg"
        role="dialog"
        aria-label="Attach context to conversation"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
          <span className="text-[length:var(--text-lg)] font-semibold text-text-primary">
            Attach Context
          </span>
          <button
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent p-0 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border-secondary px-4" role="tablist">
          <button
            className={tabClass('insights')}
            role="tab"
            aria-selected={activeTab === 'insights'}
            onClick={() => handleTabChange('insights')}
          >
            Insights
          </button>
          <button
            className={tabClass('files')}
            role="tab"
            aria-selected={activeTab === 'files'}
            onClick={() => handleTabChange('files')}
          >
            Project Files
          </button>
          <button
            className={tabClass('upload')}
            role="tab"
            aria-selected={activeTab === 'upload'}
            onClick={() => handleTabChange('upload')}
          >
            Upload
          </button>
        </div>

        {/* Tab content */}
        <div
          className="min-h-[200px] max-h-[400px] flex-1 overflow-y-auto"
          role="tabpanel"
        >
          {activeTab === 'insights' && (
            <>
              <div className="border-b border-border-secondary px-4 py-2">
                <Input
                  placeholder="Search insights..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label="Search insights"
                />
              </div>
              {filteredInsights.length === 0 ? (
                <div className="flex items-center justify-center p-8 text-[length:var(--text-sm)] text-text-muted">
                  No insights found.
                </div>
              ) : (
                <div className="py-1">
                  {filteredInsights.map(insight => {
                    const content = `${insight.origin_context}\n\n${insight.extracted_idea}`;
                    const cost = estimateCostPercent(
                      content,
                      contextWindowSize,
                    );
                    const selected = isSelected('insight', insight.id);
                    return (
                      <div
                        key={insight.id}
                        className="flex cursor-pointer items-center gap-2 px-4 py-2 transition-colors hover:bg-bg-tertiary"
                        onClick={() => toggleInsight(insight)}
                      >
                        <div
                          className={cn(
                            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 border-border-primary transition-colors',
                            selected && 'border-accent bg-accent',
                          )}
                        >
                          {selected && (
                            <svg
                              className="h-2.5 w-2.5 text-bg-primary"
                              viewBox="0 0 10 10"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M2 5l2 2 4-4" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[length:var(--text-sm)] text-text-primary">
                            {insight.title}
                          </div>
                          <div className="truncate text-[length:var(--text-xs)] text-text-tertiary">
                            {insight.source_agent} &middot;{' '}
                            {insight.tags.slice(0, 3).join(', ')}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-[var(--radius-sm)] bg-bg-tertiary px-1 text-[length:var(--text-xs)] text-text-secondary">
                          +{cost}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'files' && (
            <>
              {!filesLoaded ? (
                <div className="flex items-center justify-center p-8 text-[length:var(--text-sm)] text-text-muted">
                  Loading files...
                </div>
              ) : files.length === 0 ? (
                <div className="flex items-center justify-center p-8 text-[length:var(--text-sm)] text-text-muted">
                  No project files found.
                </div>
              ) : (
                <div className="py-1">
                  {files.map(file => {
                    const cost = estimateCostPercent(
                      'x'.repeat(file.size),
                      contextWindowSize,
                    );
                    const selected = isSelected('file', file.path);
                    return (
                      <div
                        key={file.path}
                        className="flex cursor-pointer items-center gap-2 px-4 py-2 transition-colors hover:bg-bg-tertiary"
                        onClick={() => toggleFile(file)}
                      >
                        <div
                          className={cn(
                            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 border-border-primary transition-colors',
                            selected && 'border-accent bg-accent',
                          )}
                        >
                          {selected && (
                            <svg
                              className="h-2.5 w-2.5 text-bg-primary"
                              viewBox="0 0 10 10"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M2 5l2 2 4-4" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[length:var(--text-sm)] text-text-primary">
                            {file.name}
                          </div>
                          <div className="truncate text-[length:var(--text-xs)] text-text-tertiary">
                            {file.path}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-[var(--radius-sm)] bg-bg-tertiary px-1 text-[length:var(--text-xs)] text-text-secondary">
                          ~+{cost}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'upload' && (
            <>
              <div
                className={cn(
                  'mx-4 mt-3 cursor-pointer rounded-[var(--radius-md)] border-2 border-dashed border-border-primary p-6 text-center text-text-muted transition-colors',
                  dragOver && 'border-accent bg-accent/5',
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer?.files) {
                    readUploadedFiles(e.dataTransfer.files);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) readUploadedFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Upload className="mx-auto h-8 w-8" />
                <div className="mt-2 text-[length:var(--text-sm)]">
                  Drop files here or click to browse
                </div>
                <div className="mt-1 text-[length:var(--text-xs)] text-text-tertiary">
                  Text files only. Max 1MB per file.
                </div>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="px-4 pb-3">
                  {uploadedFiles.map((file, idx) => {
                    const cost = estimateCostPercent(
                      file.content,
                      contextWindowSize,
                    );
                    return (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center gap-2 py-1"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[length:var(--text-sm)] text-text-primary">
                            {file.name}
                          </div>
                          <div className="text-[length:var(--text-xs)] text-text-tertiary">
                            {(file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <span className="shrink-0 rounded-[var(--radius-sm)] bg-bg-tertiary px-1 text-[length:var(--text-xs)] text-text-secondary">
                          +{cost}%
                        </span>
                        <button
                          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent p-0 text-text-tertiary hover:text-error"
                          onClick={() => removeUpload(idx)}
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-border-primary px-4 py-3">
          <div className="flex items-center gap-3 text-[length:var(--text-xs)] text-text-secondary">
            <span>{selectedItems.length} selected</span>
            <span>&middot;</span>
            <span>+{totalCost}% context</span>
            <span>&middot;</span>
            <span>Current: {currentContextPercent}%</span>
            <span>&middot;</span>
            <span>Projected: {projected}%</span>
          </div>
          {showWarning && (
            <div className="rounded-[var(--radius-sm)] bg-warning/10 px-2 py-1 text-[length:var(--text-xs)] text-warning">
              Attaching these items will push context usage above 80%. Consider
              attaching fewer items.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedItems.length === 0}
              onClick={handleAttach}
            >
              Attach ({selectedItems.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
