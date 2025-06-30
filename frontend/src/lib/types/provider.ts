import type { ChatCompletionRequest } from '$lib/types/chat';

export interface ProviderStrategy {
  createChatCompletion(
    config: ChatCompletionRequest,
    handleStream?: (chunk: any) => void
  ): Promise<any>;
  buildRequestBody(config: ChatCompletionRequest, params: Record<string, any>): Record<string, any>;
  getEndpoint(): string;
  formatResponse(response: any): any;
}

export class ChatCompletionError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ChatCompletionError';
  }
}

export interface ProviderConfig {
  dateField?: string;
  hasDisplayNames?: boolean;
  searchFields?: string[];
}


