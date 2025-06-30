import { writable, derived } from 'svelte/store';
import { settingsStore } from './settings';
import { providerService } from '$lib/services/providers/provider.service';
import { ProviderEnum } from '$lib/types/global';
import type { ModelType } from '$lib/types/models';
import { isModelDownloadable } from '$lib/features/search/model-selector';

// Provider information
export const providers = [
  { value: ProviderEnum.vllm, label: 'vLLM', icon: '/vllm_logo.ico' },
  { value: ProviderEnum.ollama, label: 'Ollama', icon: '/ollama_icon.png' },
  { value: ProviderEnum.anthropic, label: 'Anthropic', icon: '/ant_favicon.ico' },
  { value: ProviderEnum.openai, label: 'OpenAI', icon: '/openai_favicon.png' }
];

interface ModelSelectorState {
  currentModels: ModelType[];
  isModelDropdownOpen: boolean;
  isProviderDropdownOpen: boolean;
}

function createModelSelectorStore() {
  const INITIAL_STATE: ModelSelectorState = {
    currentModels: [],
    isModelDropdownOpen: false,
    isProviderDropdownOpen: false
  };

  const { subscribe, update, set } = writable<ModelSelectorState>(INITIAL_STATE);

  return {
    subscribe,
    
    setCurrentModels: (models: ModelType[]) => 
      update(s => ({ ...s, currentModels: models })),
    
    toggleModelDropdown: (force?: boolean) => 
      update(s => ({
        ...s,
        isModelDropdownOpen: force ?? !s.isModelDropdownOpen,
        isProviderDropdownOpen: force === true ? false : s.isProviderDropdownOpen
      })),
    
    toggleProviderDropdown: (force?: boolean) => 
      update(s => ({
        ...s,
        isProviderDropdownOpen: force ?? !s.isProviderDropdownOpen,
        isModelDropdownOpen: force === true ? false : s.isModelDropdownOpen
      })),
    
    closeDropdowns: () => 
      update(s => ({ ...s, isModelDropdownOpen: false, isProviderDropdownOpen: false })),
    
    selectModel: (modelName: string) => {
      settingsStore.setModel(modelName);
      settingsStore.save();
      console.log('Selected model saved to settings:', modelName);
    },
    
    selectProvider: (provider: ProviderEnum) => {
      settingsStore.setProvider(provider);
      settingsStore.save();
      console.log('Selected provider saved to settings:', provider);
    },
    
    reset: () => set(INITIAL_STATE)
  };
}

export const modelSelectorStore = createModelSelectorStore();

// Derived stores
export const searchTerm = derived(settingsStore, $s => $s.model);

export const filteredModels = derived(
  [modelSelectorStore, settingsStore, searchTerm],
  ([$ms, $s, $st]) => 
    !$st.trim() 
      ? $ms.currentModels 
      : providerService.filterModelsBySearchTerm($s.provider, $st)
);

export const selectedProvider = derived(
  settingsStore,
  $s => providers.find(p => p.value === $s.provider)
);

export const isDownloadable = derived(
  [settingsStore, modelSelectorStore, searchTerm],
  ([$s, $ms, $st]) => 
    isModelDownloadable($s.provider, $st, $ms.currentModels)
);