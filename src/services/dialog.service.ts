interface ElectronAPI {
  openFolder: () => Promise<string | null>;
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    return (window as unknown as { electronAPI: ElectronAPI }).electronAPI;
  }
  return null;
}

export async function selectProjectFolder(): Promise<string | null> {
  const electronAPI = getElectronAPI();
  if (electronAPI) {
    try {
      return await electronAPI.openFolder();
    } catch (err) {
      console.error('[dialog] Failed to open folder picker:', err);
    }
  }

  // Dev mode fallback: prompt for path
  const path = window.prompt('Enter the absolute path to your BMAD project folder:')?.trim();
  return path || null;
}
