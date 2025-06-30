import { settingsStore } from '$lib/stores/settings';
import { getProviderParameters, validateParameterValue } from '$lib/constants/params.constants';
import type { ParameterConfig, NumericSettingKey } from '$lib/constants/params.constants';
import { ProviderEnum } from '$lib/types/global';
import type { QdrantFilter } from '$lib/types/qdrant';
import { get } from 'svelte/store';

// Model type checking
export const isOModel = (modelName?: string): boolean => 
  modelName ? /^o\d+(-.*)?$/i.test(modelName) : false;

export const isOMiniModel = (): boolean => false;

export const supportsDeveloperRole = (modelName?: string): boolean => 
  modelName ? isOModel(modelName) : false;

const O_MODEL_PREFIX = "Formatting Re-enabled\n\n";
const DEFAULT_SYSTEM_MESSAGE = "You're a helpful AI assistant";

// Thinking mode constraints
const THINKING_CONSTRAINTS = {
  temperature: { value: 1, locked: true },
  top_p: { min: 0.95, max: 1 }
} as const;

export function updateSystemMessageForModel(
  provider: ProviderEnum | string, 
  modelName?: string,
  currentSystemMessage?: string
): boolean {
  let message = currentSystemMessage || DEFAULT_SYSTEM_MESSAGE;
  let updated = false;
  
  const isO = provider === ProviderEnum.openai && modelName && isOModel(modelName);
  const hasOPrefix = message.startsWith(O_MODEL_PREFIX);
  
  if (isO && !hasOPrefix) {
    message = O_MODEL_PREFIX + message;
    updated = true;
  } else if (!isO && hasOPrefix) {
    message = message.substring(O_MODEL_PREFIX.length);
    updated = true;
  } else if (!currentSystemMessage) {
    message = DEFAULT_SYSTEM_MESSAGE;
    updated = true;
  }
  
  if (updated) {
    settingsStore.setSystemMessage(message);
    settingsStore.save();
  }
  
  return updated;
}

// Thinking mode enforcement
export async function enforceThinkingConstraints(settings: any): Promise<boolean> {
  if (settings.provider !== ProviderEnum.anthropic || !settings.enableThinking) {
    return false;
  }

  let updated = false;
  
  if (settings.temperature !== THINKING_CONSTRAINTS.temperature.value) {
    await settingsStore.updateParameter('temperature', THINKING_CONSTRAINTS.temperature.value);
    updated = true;
  }
  
  if (settings.top_p !== undefined && 
      (settings.top_p < THINKING_CONSTRAINTS.top_p.min || 
       settings.top_p > THINKING_CONSTRAINTS.top_p.max)) {
    const constrainedValue = Math.max(THINKING_CONSTRAINTS.top_p.min, 
                                     Math.min(THINKING_CONSTRAINTS.top_p.max, settings.top_p));
    await settingsStore.updateParameter('top_p', constrainedValue);
    updated = true;
  }
  
  if (updated) {
    await settingsStore.save();
  }
  
  return updated;
}

// Get parameter constraints based on thinking mode
export function getThinkingModeConstraints(
  param: ParameterConfig, 
  provider: ProviderEnum | string, 
  enableThinking: boolean
): { min: number; max: number; disabled?: boolean } {
  if (provider === ProviderEnum.anthropic && enableThinking) {
    if (param.key === 'temperature') {
      return { 
        min: THINKING_CONSTRAINTS.temperature.value, 
        max: THINKING_CONSTRAINTS.temperature.value, 
        disabled: THINKING_CONSTRAINTS.temperature.locked 
      };
    }
    if (param.key === 'top_p') {
      return { 
        min: THINKING_CONSTRAINTS.top_p.min, 
        max: THINKING_CONSTRAINTS.top_p.max 
      };
    }
  }
  return { min: param.min, max: param.max };
}

// Apply thinking mode constraints to parameter values
export function applyThinkingConstraints(
  key: NumericSettingKey, 
  value: number, 
  provider: ProviderEnum | string, 
  enableThinking: boolean
): number {
  if (provider === ProviderEnum.anthropic && enableThinking) {
    if (key === 'temperature') {
      return THINKING_CONSTRAINTS.temperature.value;
    }
    if (key === 'top_p') {
      return Math.max(THINKING_CONSTRAINTS.top_p.min, 
                     Math.min(THINKING_CONSTRAINTS.top_p.max, value));
    }
  }
  return value;
}

// Get display value with thinking mode constraints applied
export function getConstrainedParamValue(
  param: ParameterConfig,
  currentValue: number | undefined,
  provider: ProviderEnum | string,
  enableThinking: boolean
): number {
  if (provider === ProviderEnum.anthropic && enableThinking) {
    if (param.key === 'temperature') {
      return THINKING_CONSTRAINTS.temperature.value;
    }
    if (param.key === 'top_p' && currentValue !== undefined) {
      return Math.max(THINKING_CONSTRAINTS.top_p.min, 
                     Math.min(THINKING_CONSTRAINTS.top_p.max, currentValue));
    }
  }
  return currentValue ?? param.defaultValue;
}

export const getCleanSystemMessage = (message: string): string => 
  message.startsWith(O_MODEL_PREFIX) ? message.substring(O_MODEL_PREFIX.length) : message;

export const hasOModelFormatting = (message: string): boolean => 
  message.startsWith(O_MODEL_PREFIX);

// Display logic
export const shouldShowThinkingParameter = (provider: ProviderEnum, enableThinking: boolean, key: NumericSettingKey): boolean => 
  provider === ProviderEnum.anthropic && enableThinking && key === 'thinking_budget_tokens';

export function shouldShowSystemMessage(model: string): boolean {
  const normalizedModel = model.toLowerCase();
  const noSystemMessagePatterns = [
    /^llama[23](\.1|\.2)?(:1b|-1b)/,
    /^deepseek-r\d+/,
  ];
  
  return !noSystemMessagePatterns.some(pattern => pattern.test(normalizedModel));
}

export function getSystemMessageLabel(model: string, provider?: string | ProviderEnum): string {
  return (provider === "openai" || provider === ProviderEnum.openai || model === 'o1') 
    ? "Developer Message" 
    : "System Message";
}

export function isParameterActive(key: NumericSettingKey, value: number | undefined): boolean {
  if (value === undefined) return false;
  
  switch (key) {
    case 'top_k': return value > 0;
    case 'top_p': return value < 0.99;
    default: return true;
  }
}

export function computeParameterStates(storeValue: any) {
  const availableParams = getProviderParameters(storeValue.provider);
  return availableParams.reduce(
    (acc, param) => {
      acc[param.key] = isParameterActive(param.key, storeValue[param.key]);
      return acc;
    },
    {} as Record<NumericSettingKey, boolean>
  );
}

export const shouldShowBaseUrl = (provider: ProviderEnum): boolean => 
  provider === ProviderEnum.vllm || provider === ProviderEnum.ollama;

// Enhanced parameter change handler with thinking mode support
export function handleParameterChange(
  param: ParameterConfig, 
  value: number, 
  isGenerating: boolean,
  provider: ProviderEnum | string,
  enableThinking: boolean
): boolean {
  if (isGenerating) return false;
  
  // Apply thinking mode constraints
  const constrainedValue = applyThinkingConstraints(param.key, value, provider, enableThinking);
  const validated = validateParameterValue(param.key, constrainedValue);
  
  if (validated !== undefined || param.optional) {
    settingsStore.updateParameter(param.key, validated);
    settingsStore.save();
    return true;
  }
  return false;
}

export const handleBaseUrlChange = (url: string, isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  const trimmed = url.trim();
  if (trimmed) {
    settingsStore.setBaseUrl(trimmed);
    settingsStore.save();
  }
  return true;
};

export function processStopSequences(input: string, isGenerating: boolean): string[] | null {
  if (isGenerating) return null;

  const sequences = input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  settingsStore.setStopSequences(sequences);
  settingsStore.save();
  return sequences;
}

// Enhanced thinking toggle with constraint enforcement
export const toggleThinking = async (isGenerating: boolean): Promise<boolean> => {
  if (isGenerating) return false;
  
  settingsStore.toggles.thinking();
  
  // Wait a tick for the store to update, then get the current value
  await new Promise(resolve => setTimeout(resolve, 0));
  const updatedSettings = get(settingsStore);
  
  // Enforce constraints if thinking was enabled
  if (updatedSettings.enableThinking) {
    await enforceThinkingConstraints(updatedSettings);
  }
  
  return true;
};

export const toggleTool = (toolName: string, isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  settingsStore.toggles.tool(toolName);
  settingsStore.save();
  return true;
};

export const toggleStreaming = (isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  settingsStore.toggles.streaming();
  settingsStore.save();
  return true;
};

export const toggleRAG = (isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  settingsStore.toggles.rag();
  settingsStore.save();
  return true;
};

export const updateFilter = (filter: QdrantFilter, isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  settingsStore.setQdrantFilter(filter);
  settingsStore.save();
  return true;
};

export const toggleAutomateFilters = (value: boolean, isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  settingsStore.toggles.automateFilters();
  settingsStore.save();
  return true;
};

export const handleCollectionChange = (collection: string, isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  settingsStore.setSelectedCollection(collection);
  settingsStore.save();
  return true;
};

export const toggleRerank = (isGenerating: boolean): boolean => {
  if (isGenerating) return false;
  settingsStore.toggles.rerank();
  settingsStore.save();
  return true;
};