// lib/services/providers/openai-compatible.provider.ts
import type { ChatCompletionRequest } from '$lib/types/chat';
import { OpenAIProvider } from './openai';

export class OpenAICompatibleProvider extends OpenAIProvider {
  buildRequestBody(
    config: ChatCompletionRequest,
    params: Record<string, any>
  ): Record<string, any> {
    // Always include API key and base URL for compatible providers
    const requestBody = super.buildRequestBody(config, params);

    // Ensure API key is included for compatible providers
    requestBody.api_key = config.api_key;
    if (config.base_url) requestBody.base_url = config.base_url;

    return requestBody;
  }
}