import { writable, get } from 'svelte/store';
import type { OllamaProgressStatus } from '$lib/types/ollama';

interface OllamaProgressState {
  isDownloading: boolean;
  progressStatus: OllamaProgressStatus | null;
}

function createOllamaProgressStore() {
  const INITIAL_STATE: OllamaProgressState = {
    isDownloading: false,
    progressStatus: null
  };

  const store = writable<OllamaProgressState>(INITIAL_STATE);
  const { subscribe, set, update } = store;

  return {
    subscribe,
    
    getState: () => get(store),
    
    startDownload: () => 
      update(s => ({ ...s, isDownloading: true })),
    
    stopDownload: () => set(INITIAL_STATE),
    
    updateProgress: (status: Partial<OllamaProgressStatus>) => 
      update(s => ({
        ...s,
        progressStatus: { ...s.progressStatus, ...status } as OllamaProgressStatus
      })),
    
    reset: () => set(INITIAL_STATE)
  };
}

export const ollamaProgress = createOllamaProgressStore();