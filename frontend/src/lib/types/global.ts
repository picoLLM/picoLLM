export interface Message {
	id?: string;
	tempId?: string | undefined;
	chat_session_id: string;
	role: 'user' | 'assistant' | 'system' | 'agent';
	content: string;
	metadata: MessageMetadata | null;
	created_at: Date;
	attachments?: Attachment[];
	response_time?: number;
}
export interface MessageMetadata {
	id?: string;
	response_time?: number;
	model?: string;
	usage?: TokenUsage;
	case_details?: CaseDetail[];
	web_search?: WebSearchResult[];
	file_references?: FileReference[];
	attachments?: Attachment[];
	hasImage?: boolean;
	imageInfo?: ImageInfo;
	imagePreview?: boolean;
	tool_calls?: ToolCall[];
	tool_positions?: number[]; // Add this line
}

export interface ToolCallFunction {
  name: string;
  arguments: string;
  result?: any;
}

export interface ToolCall {
	id: string;
	type: string;
	function: ToolCallFunction;
}

export interface WebSearchResult {
	title: string;
	url: string;
	snippet: string;
	source?: string;
	published_date?: string;
}

export interface CaseDetail {
	case_name: string;
	case_link: string;
	summary: string;
	impact?: string;
	verdict?: string;
	key_points?: string[];
}

export interface FileReference {
	filename: string;
	file_path?: string;
	snippet?: string;
	relevance?: number;
}

export interface Attachment {
	file_name: string;
	file_path: string;
	file_size: number;
}

export interface ImageInfo {
	filename: string;
	size: number;
	type: string;
}

export interface TokenUsage {
	input_tokens?: number;
	output_tokens?: number;
	prompt_tokens?: number;
	completion_tokens?: number;
}

export interface ChatSession {
	id: string;
	name: string | null;
	created_at: string;
	last_message?: string;
	unread_count?: number;
	messages?: Message[];
}

export enum ProviderEnum {
	vllm = 'vllm',
	ollama = 'ollama',
	anthropic = 'anthropic',
	openai = 'openai'
}
export type ProviderType = ProviderEnum;
