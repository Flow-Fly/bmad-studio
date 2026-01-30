function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Opens a native folder picker dialog. In dev mode (no Tauri),
 * falls back to a browser prompt for manual path entry.
 * Returns the selected folder path or null if cancelled.
 */
export async function selectProjectFolder(): Promise<string | null> {
  if (isTauriAvailable()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      title: 'Select BMAD Project Folder',
    });
    // open() returns string | string[] | null for directory mode
    if (typeof selected === 'string') return selected;
    if (Array.isArray(selected) && selected.length > 0) return selected[0];
    return null;
  }

  // Dev mode fallback: prompt for path
  const path = window.prompt('Enter the absolute path to your BMAD project folder:');
  if (!path || path.trim() === '') return null;
  return path.trim();
}
