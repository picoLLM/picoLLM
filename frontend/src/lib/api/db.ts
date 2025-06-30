import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { v4 as uuidv4 } from 'uuid';
import type { ChatSession, Message } from '$lib/types/global';
import type { ChatCompletionRequest } from '$lib/types/chat';
import { getProviderSpecificParams } from '$lib/types/chat';
import { BACKEND_URL } from '$lib/constants/global.constants';
import { fileToBase64 } from '$lib/utils/files';

// Constants
const PAGE_SIZE = 50;
const MAX_CACHE_SIZE = 100;

// ============================================
// Message Buffer Management
// ============================================
const pendingMessagesBuffer = {
	messages: new Map<string, Map<string, Message>>(),

	addMessage(sessionId: string, message: Message) {
		if (!this.messages.has(sessionId)) {
			this.messages.set(sessionId, new Map());
		}
		this.messages.get(sessionId)?.set(message.tempId!, message);
	},

	getMessage(sessionId: string, tempId: string): Message | undefined {
		return this.messages.get(sessionId)?.get(tempId);
	},

	removeMessage(sessionId: string, tempId: string) {
		this.messages.get(sessionId)?.delete(tempId);
	},

	clearSession(sessionId: string) {
		this.messages.delete(sessionId);
	}
};

// ============================================
// API Endpoints
// ============================================
const api = {
	sessions: (page: number) => `${BACKEND_URL}/chat-sessions?page=${page}&limit=${PAGE_SIZE}`,

	messages: (sessionId: string, params: URLSearchParams) =>
		`${BACKEND_URL}/chat-sessions/${sessionId}/messages?${params}`,

	addMessage: (sessionId: string) => `${BACKEND_URL}/chat-sessions/${sessionId}/messages`,

	createSession: () => `${BACKEND_URL}/chat-sessions`,

	chat: (provider: string, baseUrl?: string) =>
		baseUrl || `${BACKEND_URL}/chat/${provider.toLowerCase()}`
};

// ============================================
// Utility Functions
// ============================================
function processMessage(message: Message): Message {
	return {
		...message,
		created_at: new Date(message.created_at),
		content: message.content?.trim() || ''
	};
}

function processPaginatedResponse(result: any): {
	messages: Message[];
	hasMore: boolean;
} {
	const isPaginated = result?.data && Array.isArray(result.data) && 'has_more' in result;

	if (isPaginated) {
		return {
			messages: result.data.map(processMessage),
			hasMore: result.has_more
		};
	}

	const messages = (Array.isArray(result) ? result : []).map(processMessage);
	return {
		messages,
		hasMore: messages.length >= PAGE_SIZE
	};
}

// ============================================
// Session Management
// ============================================
export async function fetchChatSessions(page: number = 1): Promise<number> {
	chatStore.setLoadingMore(true);

	try {
		const response = await fetch(api.sessions(page));

		if (!response.ok) {
			throw new Error(`Failed to fetch sessions: ${response.statusText}`);
		}

		const data: ChatSession[] = await response.json();

		if (!Array.isArray(data)) {
			throw new Error('Invalid response format from server');
		}

		chatStore.update((state) => ({
			...state,
			sessions: page === 1 ? data : [...state.sessions, ...data]
		}));

		return page;
	} catch (error) {
		console.error('Error fetching chat sessions:', error);
		throw error;
	} finally {
		chatStore.setLoadingMore(false);
	}
}

export async function fetchSessionMessages(
	sessionId: string,
	limit: number = PAGE_SIZE
): Promise<Message[]> {
	const params = new URLSearchParams({
		limit: String(limit),
		direction: 'backward' // Get most recent messages
	});

	const response = await fetch(api.messages(sessionId, params));

	if (!response.ok) {
		throw new Error(`Failed to fetch messages: ${response.statusText}`);
	}

	const result = await response.json();
	const { messages } = processPaginatedResponse(result);

	return messages.reverse(); // Reverse to get chronological order
}

export async function createNewChat(firstMessage?: string): Promise<ChatSession> {
	const response = await fetch(api.createSession(), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ first_message: firstMessage })
	});

	if (!response.ok) {
		throw new Error('Failed to create new chat session');
	}

	return response.json();
}

export async function selectChat(sessionId: string) {
	chatStore.update((state) => ({
		...state,
		currentSessionId: sessionId,
		isLoadingMessages: true,
		messages: [],
		bufferedMessages: []
	}));

	try {
		await fetchCurrentSession(sessionId);
	} finally {
		chatStore.setLoadingMessages(false);
	}
}

async function fetchCurrentSession(sessionId: string) {
	const params = new URLSearchParams({
		limit: String(PAGE_SIZE),
		direction: 'forward'
	});

	const response = await fetch(api.messages(sessionId, params));

	if (!response.ok) {
		throw new Error(`Failed to fetch session: ${response.statusText}`);
	}

	const result = await response.json();
	const { messages, hasMore } = processPaginatedResponse(result);

	chatStore.update((state) => ({
		...state,
		messages,
		bufferedMessages: messages,
		hasMoreMessages: hasMore
	}));
}

// ============================================
// Message Management
// ============================================
export function createMessage(
	chat_session_id: string,
	role: Message['role'],
	content: string,
	metadata?: Message['metadata'] | null
): Message {
	return {
		tempId: uuidv4(),
		chat_session_id,
		role,
		content,
		metadata: metadata || null,
		created_at: new Date()
	};
}

export async function addMessage(message: Message, file?: File): Promise<Message> {
	if (message.tempId) {
		pendingMessagesBuffer.addMessage(message.chat_session_id, message);
	}

	try {
		const payload: any = {
			role: message.role,
			content: message.content,
			metadata:
				message.metadata?.attachments || Object.keys(message.metadata || {}).length > 0
					? message.metadata
					: null
		};

		if (file) {
			payload.image_data = {
				fileName: file.name,
				fileType: file.type,
				data: await fileToBase64(file)
			};
			payload.metadata = { ...payload.metadata, attachments: true };
		}

		const response = await fetch(api.addMessage(message.chat_session_id), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error('Failed to add message to the server');
		}

		const savedMessage: Message = await response.json();
		savedMessage.tempId = message.tempId;

		if (message.tempId) {
			pendingMessagesBuffer.removeMessage(message.chat_session_id, message.tempId);
		}

		return savedMessage;
	} catch (error) {
		console.error('Error adding message:', error);
		throw error;
	}
}

export async function loadMoreMessages() {
	const state = get(chatStore);
	const { currentSessionId, messages, hasMoreMessages, isLoadingMessages } = state;

	if (!currentSessionId || !hasMoreMessages || isLoadingMessages || !messages.length) {
		return;
	}

	chatStore.setLoadingMessages(true);

	try {
		const lastMessage = messages[messages.length - 1];
		const cursor = `${lastMessage.created_at.toISOString()},${lastMessage.id}`;

		const params = new URLSearchParams({
			limit: String(PAGE_SIZE),
			direction: 'forward',
			cursor
		});

		const response = await fetch(api.messages(currentSessionId, params));

		if (!response.ok) {
			throw new Error(`Failed to fetch messages: ${response.statusText}`);
		}

		const result = await response.json();
		const { messages: newMessages, hasMore } = processPaginatedResponse(result);

		if (newMessages.length > 0) {
			chatStore.update((state) => {
				const messageIds = new Set(state.messages.map((m) => m.id));
				const uniqueNewMessages = newMessages.filter((m) => !messageIds.has(m.id));

				return {
					...state,
					messages: [...state.messages, ...uniqueNewMessages],
					bufferedMessages: [...state.bufferedMessages, ...uniqueNewMessages].slice(
						-MAX_CACHE_SIZE
					),
					hasMoreMessages: hasMore
				};
			});
		} else {
			chatStore.setHasMoreMessages(false);
		}
	} catch (error) {
		console.error('Error fetching messages:', error);
	} finally {
		chatStore.setLoadingMessages(false);
	}
}

// ============================================
// Chat Completion
// ============================================
export async function getStreamingChatCompletion(requestPayload: ChatCompletionRequest) {
	const { provider, base_url, ...restPayload } = requestPayload;
	const providerParams = getProviderSpecificParams(requestPayload);

	const response = await fetch(api.chat(provider, base_url), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...restPayload,
			...providerParams,
			stream: true
		})
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return response;
}

export async function getChatCompletion(requestPayload: ChatCompletionRequest) {
	const { provider, base_url, ...restPayload } = requestPayload;
	const providerParams = getProviderSpecificParams(requestPayload);

	const response = await fetch(api.chat(provider, base_url), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			...restPayload,
			...providerParams,
			stream: false
		})
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return response.json();
}

export async function sendStreamingChat(requestPayload: ChatCompletionRequest) {
	const currentSessionId = get(chatStore).currentSessionId;
	if (!currentSessionId) throw new Error('No active session found.');

	const assistantMessage = createMessage(currentSessionId, 'assistant', '');

	chatStore.update((state) => ({
		...state,
		isGeneratingMessage: true,
		isStreaming: true,
		messages: [...state.messages, assistantMessage]
	}));

	try {
		const response = await getStreamingChatCompletion(requestPayload);
		const reader = response.body!.getReader();
		const decoder = new TextDecoder();

		let buffer = '';
		let content = '';
		let isFirstChunk = true;

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const messages = buffer.split('\n\n');
			buffer = messages.pop() || '';

			for (let i = 0; i < messages.length; i++) {
				const line = messages[i].trim();
				if (!line.startsWith('data: ')) continue;

				// Skip empty delta before [DONE]
				if (
					line === 'data: {"delta": "", "metadata": null}' &&
					messages[i + 1]?.trim() === 'data: [DONE]'
				) {
					continue;
				}

				try {
					const parsed = JSON.parse(line.slice(5));

					if (isFirstChunk && parsed.metadata) {
						chatStore.updateMessage(assistantMessage.tempId!, { metadata: parsed.metadata });
						isFirstChunk = false;
						continue;
					}

					if (parsed.delta) {
						content += parsed.delta;
						chatStore.updateMessage(assistantMessage.tempId!, { content });
					}
				} catch (e) {
					console.error('Error processing stream chunk:', e);
				}
			}
		}

		// Save the final message
		const finalMessage = get(chatStore).messages.find((m) => m.tempId === assistantMessage.tempId);
		if (finalMessage) {
			const savedMessage = await addMessage(finalMessage);
			chatStore.updateMessage(assistantMessage.tempId!, { id: savedMessage.id });
		}
	} catch (error) {
		console.error('Error in sendStreamingChat:', error);
		chatStore.addMessage(
			createMessage(
				currentSessionId,
				'system',
				'An error occurred while processing your request. Please try again.'
			)
		);
	} finally {
		chatStore.update((state) => ({
			...state,
			isGeneratingMessage: false,
			isStreaming: false
		}));
	}
}
