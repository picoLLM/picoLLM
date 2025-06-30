// lib/stores/theme.store.ts
import { writable, derived } from 'svelte/store';
import type { Theme, ColorTheme, ThemeState, ThemeColors } from '$lib/features/highlighter/highlighter.types';
import { customThemes, vscodeThemes } from '$lib/features/highlighter/highlighter.constants';
import { browser } from '$app/environment';

const STORAGE_KEYS = {
  THEME: 'theme',
  COLOR_THEME: 'colorTheme'
} as const;

const DEFAULT_STATE: ThemeState = {
  theme: 'dark',
  colorTheme: 'custom'
};

function createThemeStore() {
  // Initialize from localStorage or defaults
  const getInitialState = (): ThemeState => {
    if (!browser) return DEFAULT_STATE;
    
    return {
      theme: (localStorage.getItem(STORAGE_KEYS.THEME) as Theme) || DEFAULT_STATE.theme,
      colorTheme: (localStorage.getItem(STORAGE_KEYS.COLOR_THEME) as ColorTheme) || DEFAULT_STATE.colorTheme
    };
  };

  const { subscribe, update } = writable<ThemeState>(getInitialState());

  // Helper to safely update localStorage
  const saveToStorage = (key: keyof typeof STORAGE_KEYS, value: string) => {
    if (!browser) return;
    
    try {
      localStorage.setItem(STORAGE_KEYS[key], value);
    } catch (e) {
      console.warn(`Failed to save ${key} to localStorage:`, e);
    }
  };

  // Generic update function
  const updateField = <K extends keyof ThemeState>(
    field: K, 
    value: ThemeState[K], 
    storageKey: keyof typeof STORAGE_KEYS
  ) => {
    saveToStorage(storageKey, value);
    update(s => ({ ...s, [field]: value }));
  };

  return {
    subscribe,
    
    setTheme: (theme: Theme) => 
      updateField('theme', theme, 'THEME'),
    
    setColorTheme: (colorTheme: ColorTheme) => 
      updateField('colorTheme', colorTheme, 'COLOR_THEME'),
    
    toggleColorTheme: () => 
      update(s => {
        const colorTheme = s.colorTheme === 'custom' ? 'vscode' : 'custom';
        saveToStorage('COLOR_THEME', colorTheme);
        return { ...s, colorTheme };
      }),
    
    toggleTheme: () => 
      update(s => {
        const theme = s.theme === 'dark' ? 'light' : 'dark';
        saveToStorage('THEME', theme);
        return { ...s, theme };
      }),
    
    reset: () => {
      if (browser) {
        localStorage.setItem(STORAGE_KEYS.THEME, DEFAULT_STATE.theme);
        localStorage.setItem(STORAGE_KEYS.COLOR_THEME, DEFAULT_STATE.colorTheme);
      }
      update(() => DEFAULT_STATE);
    }
  };
}

export const themeStore = createThemeStore();

// Derived stores
export const theme = derived(themeStore, $s => $s.theme);
export const colorTheme = derived(themeStore, $s => $s.colorTheme);

// Helper function to get current theme variables
export const getCurrentThemeColors = (theme: Theme, colorTheme: ColorTheme): ThemeColors =>
  (colorTheme === 'vscode' ? vscodeThemes : customThemes)[theme];