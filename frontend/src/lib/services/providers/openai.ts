import { BACKEND_URL } from '$lib/constants/global.constants';
import type { ChatCompletionRequest, APIMessages } from '$lib/types/chat';
import type { ProviderStrategy } from '$lib/types/provider';
import { sendRequest } from '$lib/api/http';
import { prepareNumericParameters, prepareProviderParameters } from '../../utils/request';
import {
	shouldShowSystemMessage,
	isOModel,
	isOMiniModel,
	supportsDeveloperRole
} from '$lib/services/settings/tool-settings-menu';

export class OpenAIProvider implements ProviderStrategy {
	getEndpoint(): string {
		return `${BACKEND_URL}/v1/chat/completions`;
	}

	buildRequestBody(
		config: ChatCompletionRequest,
		params: Record<string, any>
	): Record<string, any> {
		const isO = isOModel(config.model);
		
		const requestBody: Record<string, any> = {
			messages: this.formatAPIMessages(config.messages, config.model),
			model: config.model,
			provider: config.provider,
			stream: Boolean(config.stream),
			...(config.provider !== 'openai' && {
				api_key: config.api_key,
				...(config.base_url && { base_url: config.base_url })
			}),
			...(config.max_tokens !== undefined && { max_completion_tokens: config.max_tokens }),
			...(!isO && {
				...(config.temperature !== undefined && { temperature: config.temperature }),
				...(config.top_p !== undefined && { top_p: config.top_p }),
				...(config.n !== undefined && { n: config.n }),
				...(config.presence_penalty !== undefined && { presence_penalty: config.presence_penalty }),
				...(config.frequency_penalty !== undefined && { frequency_penalty: config.frequency_penalty })
			}),
			// Add reasoning_effort for o-models
			...(isO && config.reasoning_effort !== undefined && { 
				reasoning_effort: config.reasoning_effort 
			}),
			...(config.tools?.length && { tools: config.tools }),
			...params
		};

		// Remove unwanted parameters
		delete requestBody.max_tokens;
		delete requestBody.top_k;

		// Additional cleanup for O models
		if (isO) {
			['temperature', 'top_p', 'n', 'presence_penalty', 'frequency_penalty', 'logprobs']
				.forEach(p => delete requestBody[p]);
		}

		return requestBody;
	}

	formatAPIMessages(messages: APIMessages[], model: string): APIMessages[] {
		const supportsSystem = shouldShowSystemMessage(model);
		const supportsDev = supportsDeveloperRole(model);
		const isOMini = isOMiniModel();

		return JSON.parse(JSON.stringify(messages))
			.map((msg: APIMessages) => {
				if (Array.isArray(msg.content)) return msg;
				
				if (msg.role === 'system') {
					if (!supportsSystem || isOMini) return null;
					if (supportsDev) return { ...msg, role: 'developer' };
				}
				
				return msg;
			})
			.filter(Boolean);
	}

	async createChatCompletion(
		config: ChatCompletionRequest,
		handleStream?: (chunk: any) => void
	): Promise<any> {
		return sendRequest(
			this.getEndpoint(),
			this.buildRequestBody(config, prepareProviderParameters(config, prepareNumericParameters(config))),
			handleStream,
			Boolean(config.stream)
		);
	}

	formatResponse(response: any): any {
		return response;
	}
}