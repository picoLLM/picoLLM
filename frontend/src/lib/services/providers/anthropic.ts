import { BACKEND_URL } from '$lib/constants/global.constants';
import type { ChatCompletionRequest, APIMessages } from '$lib/types/chat';
import type { ProviderStrategy } from '$lib/types/provider';
import { sendRequest } from '$lib/api/http';
import { prepareNumericParameters, prepareProviderParameters } from '../../utils/request';

export class AnthropicProvider implements ProviderStrategy {
	getEndpoint(): string {
		return `${BACKEND_URL}/v1/messages`;
	}

	buildRequestBody(
		config: ChatCompletionRequest,
		params: Record<string, any>
	): Record<string, any> {
		const systemMessage = config.messages.find(msg => msg.role === 'system')?.content;
		const formattedAPIMessages = config.messages.filter(msg => msg.role !== 'system');
		const isThinkingEnabled = config.thinking?.type === 'enabled';

		const requestBody = {
			messages: formattedAPIMessages,
			model: config.model,
			provider: config.provider,
			stream: config.stream,
			...(config.temperature !== undefined && {
				temperature: isThinkingEnabled ? 1 : config.temperature
			}),
			...(config.max_tokens !== undefined && { max_tokens: config.max_tokens }),
			...(config.top_p !== undefined && { top_p: config.top_p }),
			...(!isThinkingEnabled && config.top_k !== undefined && { top_k: config.top_k }),
			...(config.stop_sequences?.length && { stop_sequences: config.stop_sequences }),
			...(systemMessage && { system: systemMessage }),
			...(config.metadata && { metadata: config.metadata }),
			...(config.provider !== 'anthropic' && config.api_key && { api_key: config.api_key }),
			...(config.provider !== 'anthropic' && config.base_url && { base_url: config.base_url }),
			...(config.tools?.length && { tools: config.tools }),
			...(config.thinking && { thinking: config.thinking }),
			...params
		};

		if (isThinkingEnabled) delete requestBody.top_k;

		return requestBody;
	}

	async createChatCompletion(
		config: ChatCompletionRequest,
		handleStream?: (chunk: any) => void
	): Promise<any> {
		const requestBody = this.buildRequestBody(
			config,
			prepareProviderParameters(config, prepareNumericParameters(config))
		);

		const response = await sendRequest(
			this.getEndpoint(),
			requestBody,
			handleStream,
			config.stream
		);

		return config.stream ? response : this.formatResponse(response);
	}

	formatResponse(response: any): any {
		if (response.choices?.[0]?.message) return response;

		return {
			choices: [{
				message: {
					content: response.response || response.content || '',
					...(response.tool_calls && { tool_calls: response.tool_calls })
				}
			}],
			metadata: response.metadata,
			...(response.usage && { usage: response.usage })
		};
	}
}