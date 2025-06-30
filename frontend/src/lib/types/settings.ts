import { ProviderEnum } from '$lib/types/global';
import type { QdrantFilter } from '$lib/types/qdrant';
import { DEFAULT_MODEL } from '$lib/constants/global.constants';
import { providerBaseUrls } from '$lib/services/providers/provider.service';

// Core settings that are persisted and used across the app
export interface Settings {
  // Provider & Model
  apiKey: string | null;
  baseUrl: string;
  provider: ProviderEnum;
  model: string;
  
  systemMessage: string;
  
  temperature: number;
  max_tokens: number;
  stream: boolean;
  
  top_p: number | undefined;
  n: number | undefined;
  presence_penalty: number | undefined;
  frequency_penalty: number | undefined;
  top_k: number | undefined;
  reasoning_effort?: 'low' | 'medium' | 'high';
	reasoning_summary?: 'auto' | 'concise' | 'detailed';
  
  max_tokens_to_sample: number | null;
  stop_sequences: string[] | null;
  system: string | null;
  
  // Features
  enableThinking: boolean;
  thinking_budget_tokens: number;
  enableRAG: boolean;
  rerank: boolean;
  automateFilters: boolean;
  enableAgent: boolean;
  agentMode: 'research' | 'chat' | 'default';
  agentWebSocket: boolean;
  
  // Tools & Collections
  selectedTools: string[];
  availableTools: Record<string, string>;
  selectedCollection: string;
  
  // Filters & Metadata
  qdrantFilter: QdrantFilter | null;
  metadata: Record<string, any> | null;
  
  // UI State
  alpha: number;
  streaming: boolean;
}

// Aliases for clarity
export type SettingsState = Settings;

// Default settings factory
export function createDefaultSettings(): Settings {
  return {
    apiKey: 'ollama',
    baseUrl: providerBaseUrls[ProviderEnum.ollama] || '',
    provider: ProviderEnum.ollama,
    model: DEFAULT_MODEL,
    systemMessage: 'You are a helpful assistant.',
    temperature: 0.3,
    top_p: undefined,
    n: 1,
    stream: true,
    max_tokens: 2048,
    presence_penalty: 0,
    frequency_penalty: 0,
    reasoning_effort: undefined,
		reasoning_summary: undefined,
    selectedTools: [],
    availableTools: {},
    max_tokens_to_sample: null,
    stop_sequences: null,
    system: null,
    top_k: 0,
    enableThinking: false,
    thinking_budget_tokens: 1024,
    metadata: null,
    alpha: 0.5,
    streaming: true,
    enableRAG: true,
    rerank: false,
    automateFilters: false,
    qdrantFilter: null,
    selectedCollection: '',
    enableAgent: false,
    agentMode: 'default',
    agentWebSocket: false
  };
}
