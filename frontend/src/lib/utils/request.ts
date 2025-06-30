// lib/services/utils/request.utils.ts
import { numericParamKeys } from '$lib/constants/params.constants';
import type { SettingsState } from '$lib/types/settings';
import { ProviderEnum } from '$lib/types/global';
import { isOModel } from '$lib/services/settings/tool-settings-menu';

export function prepareNumericParameters(settings: Partial<SettingsState>) {
  const requestParams: Record<string, any> = {};
  numericParamKeys.forEach((key) => {
    const val = settings[key];
    // Only assign if val != undefined
    if (val !== undefined) {
      requestParams[key] = val;
    }
  });
  return requestParams;
}

export function prepareProviderParameters(
  settings: Partial<SettingsState>,
  requestParams: Record<string, any>
): Record<string, any> {
  const params = { ...requestParams };

  // Anthropic-specific
  if (settings.provider === ProviderEnum.anthropic) {
    if (settings.top_k !== undefined) {
      params.top_k = settings.top_k;
    }
    if (settings.stop_sequences && settings.stop_sequences.length > 0) {
      params.stop_sequences = settings.stop_sequences;
    }
    if (settings.system) {
      params.system = settings.system;
    }
    if (settings.metadata && Object.keys(settings.metadata).length > 0) {
      params.metadata = settings.metadata;
    }

    // max_tokens_to_sample vs. max_tokens
    if (settings.max_tokens_to_sample !== undefined) {
      params.max_tokens_to_sample = settings.max_tokens_to_sample;
      delete params.max_tokens;
    }
  } else if (settings.provider === ProviderEnum.openai) {
    // For OpenAI, convert max_tokens to max_completion_tokens
    if (params.max_tokens !== undefined) {
      params.max_completion_tokens = params.max_tokens;
      delete params.max_tokens;
    }

    // Check for O model and exclude unsupported parameters
    if (isOModel(settings.model)) {
      // For O models, remove unsupported parameters
      delete params.temperature;
      delete params.top_p;
      delete params.presence_penalty;
      delete params.frequency_penalty;
      delete params.n;
    } else {
      // For non-O models, include all standard parameters
      if (settings.presence_penalty !== undefined) {
        params.presence_penalty = settings.presence_penalty;
      }
      if (settings.frequency_penalty !== undefined) {
        params.frequency_penalty = settings.frequency_penalty;
      }
      if (settings.n !== undefined) {
        params.n = settings.n;
      }
      if (settings.temperature !== undefined) {
        params.temperature = settings.temperature;
      }
      if (settings.top_p !== undefined) {
        params.top_p = settings.top_p;
      }
    }
  }

  // RAG-specific
  if (settings.enableRAG && settings.alpha !== undefined) {
    params.alpha = settings.alpha;
  }

  return params;
}