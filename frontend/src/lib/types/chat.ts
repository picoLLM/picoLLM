import { ProviderEnum } from './global';

export interface PaginatedResponse<T> {
	data: T[];
	cursor?: string;
	has_more: boolean;
}

export interface APIMessages {
	role: string;
	content: string | any[];
}

export interface AnthropicRequestBody extends Omit<ChatCompletionRequest, 'messages'> {
	messages: APIMessages[];
	system?: string;
}

export interface Tool {
	type: string;
	function: {
		name: string;
		description: string;
		parameters: Record<string, any>;
	};
}

export interface ChatCompletionRequest {
	// Essential Parameters
	messages: APIMessages[];
	model: string;

	// API Configuration
	api_key: string;
	provider: ProviderEnum;
	base_url?: string;

	// Common Parameters
	temperature?: number; // Default: 0.7, Range: 0-1
	top_p?: number; // Default: 1.0, Range: 0-1
	max_tokens?: number; // Minimum: 1
	stream?: boolean; // Default: false
	reasoning_effort?: 'low' | 'medium' | 'high'; // OpenAI-specific, Default: 'medium'

	// Anthropic-specific Parameters
	top_k?: number; // Only sample from top K options for each token
	stop_sequences?: string[]; // Sequences that will cause the model to stop
	system?: string; // System prompt
	metadata?: Record<string, any> | null; // Updated to match settings store
	thinking?: {
		type: 'disabled' | 'enabled';
		budget_tokens: number;
	};
	

	// OpenAI-specific Parameters
	presence_penalty?: number; // Default: 0.0
	frequency_penalty?: number; // Default: 0.0
	n?: number; // Default: 1, Number of completions to generate
	reasoning?: {
		effort?: 'low' | 'medium' | 'high';
		summary?: 'auto' | 'concise' | 'detailed';
	};
	// Tool Configuration
	tools?: string[]; // Names of tools to use
}

export interface ChatProvider {
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


/**
 * Type guard to check if the provider is Anthropic
 */
export function isAnthropicProvider(provider: ProviderEnum): boolean {
	return provider === ProviderEnum.anthropic;
}

/**
 * Type guard to check if the provider is OpenAI
 */
export function isOpenAIProvider(provider: ProviderEnum): boolean {
	return provider === ProviderEnum.openai;
}

/**
 * Helper to get provider-specific parameters
 */
export function getProviderSpecificParams(
	request: ChatCompletionRequest
): Partial<ChatCompletionRequest> {
	if (isAnthropicProvider(request.provider)) {
		return {
			top_k: request.top_k,
			stop_sequences: request.stop_sequences,
			system: request.system,
			metadata: request.metadata
		};
	}

	if (isOpenAIProvider(request.provider)) {
		return {
			presence_penalty: request.presence_penalty,
			frequency_penalty: request.frequency_penalty,
			n: request.n
		};
	}

	return {};
}
