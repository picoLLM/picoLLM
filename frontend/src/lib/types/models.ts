import type { ProviderEnum } from "./global";

export interface ModelLists {
	[ProviderEnum.vllm]: vLLMModel[];
	[ProviderEnum.ollama]: OllamaModelDetails[];
	[ProviderEnum.anthropic]: string[];
	[ProviderEnum.openai]: string[];
}

export type FormattedModelInfo = {
	name: string;
	params?: string;
	size?: string;
	quantization?: string;
	owner?: string;
	created?: string;
	modelLen?: string;
};

export interface ModelPermission {
	id: string;
	object: string;
	created: number;
	allow_create_engine: boolean;
	allow_sampling: boolean;
	allow_logprobs: boolean;
	allow_search_indices: boolean;
	allow_view: boolean;
	allow_fine_tuning: boolean;
	organization: string;
	group: string | null;
	is_blocking: boolean;
}
export interface OllamaModelDetails {
	name: string;
	model: string;
	modified_at: string;
	size: number;
	digest: string;
	details: {
		parent_model: string;
		format: string;
		family: string;
		families: string[];
		parameter_size: string;
		quantization_level: string;
	};
}

export interface vLLMModel {
	id: string;
	object: string;
	created: number;
	owned_by: string;
	root?: string;
	parent?: string | null;
	max_model_len?: number;
	permission?: ModelPermission[];
}

export interface AnthropicModel {
	id: string;
	created_at: string;
	display_name: string;
	type: string;
}
export interface AnthropicModelResponse {
	data: Array<{
		id: string;
		created_at: string;
		display_name: string;
		type: string;
	}>;
	has_more: boolean;
	first_id: string;
	last_id: string;
}

export type ModelType = string | vLLMModel | OllamaModelDetails | AnthropicModel;
