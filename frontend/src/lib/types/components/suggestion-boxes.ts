// src/lib/types/models.ts
import type { ComponentType, SvelteComponent } from 'svelte';
import type { IconProps } from 'lucide-svelte';

export interface ModelSuggestion {
  text: string;
  icon: ComponentType<SvelteComponent<IconProps>>;
  color: string;
  modelTag: string;
}

export type ModelCapability = string;