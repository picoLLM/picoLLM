import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { settingsStore } from '$lib/stores/settings';
import { routeChatCompletion } from '$lib/api/api';
import { TitleService } from '$lib/api/title';
import type { ChatCompletionRequest } from '$lib/types/chat';
import type { ChatSession, Message } from '$lib/types/global';
import type { Settings } from '$lib/types/settings';
import {
	fetchChatSessions,
	selectChat,
	loadMoreMessages,
	addMessage,
	createMessage,
	createNewChat
} from '$lib/api/db';

class PicoLLMService {
	get currentSessionId() {
		return get(chatStore).currentSessionId;
	}
	get hasMoreMessages() {
		return get(chatStore).hasMoreMessages;
	}
	get sessions() {
		return get(chatStore).sessions;
	}

	async initialize() {
		console.log('App mounting - loading settings');
		settingsStore.loadFromLocalStorage();

		try {
			console.log('Fetching sessions from backend API');
			await fetchChatSessions();
			console.log(`Fetched ${this.sessions.length} sessions from API`);
			if (this.sessions.length > 0) {
				console.log(`Selecting first session: ${this.sessions[0].id}`);
				selectChat(this.sessions[0].id);
			}
		} catch (error) {
			console.error('Error fetching chat sessions:', error);
		}
	}

	async sendMessage(query: string, messageInputComponent: any) {
		console.log('handleSendMessage received query:', query);
		const stagedFile = messageInputComponent?.messageService?.stagedFile;
		const hasImage = stagedFile?.type === 'image';

		if (!query.trim() && !hasImage) return;

		try {
			if (!this.currentSessionId) {
				const newSession = await createNewChat();
				chatStore.setCurrentSessionId(newSession.id);
			}

			const userMessage = createMessage(this.currentSessionId!, 'user', query);

			if (hasImage && stagedFile.file && stagedFile.preview) {
				userMessage.metadata = {
					...userMessage.metadata,
					hasImage: true,
					imagePreview: stagedFile.preview,
					imageInfo: {
						filename: stagedFile.file.name,
						type: stagedFile.file.type,
						size: stagedFile.file.size
					}
				};
			}

			chatStore.addMessage(userMessage);
			const savedUserMessage = await addMessage(
				userMessage,
				hasImage ? stagedFile.file : undefined
			);
			chatStore.updateMessage(userMessage.tempId!, { id: savedUserMessage.id });

			if (get(chatStore).messages.length === 1) {
				await TitleService.generateAndUpdateTitle(
					this.currentSessionId!,
					query || 'Image analysis',
					get(settingsStore)
				);
			}

			chatStore.setGeneratingMessage(true);
			await this.handleMessage(query, messageInputComponent);

			if (hasImage && messageInputComponent) {
				messageInputComponent.clearStagedFile();
			}
		} catch (error) {
			console.error('Error in message handling:', error);
			this.handleError(this.currentSessionId!, error);
		}
	}

	private createStreamHandler(tempMessage: any, accumulatedContentRef: { value: string }) {
		// Persist state across all handler invocations
		const streamingState = {
			toolCalls: [] as any[],
			currentToolCall: null as any,
			toolPositions: [] as number[],
			thinkingContent: '',
			isThinking: false,
			hasThinkingContent: false,
			regularContent: '',
			processedToolIds: new Set<string>() // Track processed tools to avoid duplicates
		};

		return (parsedData: any) => {
			// Handle OpenAI-style tool calls (complete tool call with result in one message)
			if (parsedData.tool_calls && Array.isArray(parsedData.tool_calls)) {
				console.log('OpenAI tool calls received:', parsedData.tool_calls);

				for (const tc of parsedData.tool_calls) {
					// Skip if already processed
					if (streamingState.processedToolIds.has(tc.id)) continue;

					// Record position where tool was called
					streamingState.toolPositions.push(accumulatedContentRef.value.length);

					// Add the complete tool call
					streamingState.toolCalls.push(tc);
					streamingState.processedToolIds.add(tc.id);
				}

				// Update metadata with all tool calls
				const currentMetadata = tempMessage.metadata || {};
				currentMetadata.tool_calls = [...streamingState.toolCalls];
				currentMetadata.tool_positions = [...streamingState.toolPositions];
				chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });

				// Don't return early - continue processing other events
			}

			// Handle thinking events (Anthropic)
			if (parsedData.thinking_start) {
				console.log('Thinking started');
				streamingState.isThinking = true;
				streamingState.thinkingContent = '';
				streamingState.hasThinkingContent = true;

				const currentMetadata = tempMessage.metadata || {};
				currentMetadata.thinking = {
					isActive: true,
					content: '',
					startTime: new Date().toISOString()
				};
				chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
			}

			if (parsedData.thinking_delta) {
				console.log('Thinking delta:', parsedData.thinking_delta);

				streamingState.thinkingContent += parsedData.thinking_delta;

				if (streamingState.hasThinkingContent) {
					accumulatedContentRef.value =
						'<think>\n' +
						streamingState.thinkingContent +
						(streamingState.isThinking ? '' : '\n</think>\n') +
						streamingState.regularContent;

					chatStore.updateMessage(tempMessage.tempId!, { content: accumulatedContentRef.value });
				}

				const currentMetadata = tempMessage.metadata || {};
				if (!currentMetadata.thinking) {
					currentMetadata.thinking = { isActive: true, content: '' };
				}
				currentMetadata.thinking.content = streamingState.thinkingContent;
				chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
			}

			if (
				parsedData.thinking_end ||
				(streamingState.isThinking && parsedData.delta !== undefined)
			) {
				if (streamingState.isThinking) {
					console.log('Thinking ended');
					streamingState.isThinking = false;

					if (streamingState.hasThinkingContent) {
						accumulatedContentRef.value =
							'<think>\n' +
							streamingState.thinkingContent +
							'\n</think>\n' +
							streamingState.regularContent;

						chatStore.updateMessage(tempMessage.tempId!, { content: accumulatedContentRef.value });
					}

					const currentMetadata = tempMessage.metadata || {};
					if (currentMetadata.thinking) {
						currentMetadata.thinking.isActive = false;
						currentMetadata.thinking.endTime = new Date().toISOString();
					}
					chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
				}
			}

			// Handle text deltas
			if (parsedData.delta !== undefined) {
				streamingState.regularContent += parsedData.delta;

				if (streamingState.hasThinkingContent) {
					accumulatedContentRef.value =
						'<think>\n' +
						streamingState.thinkingContent +
						'\n</think>\n' +
						streamingState.regularContent;
				} else {
					accumulatedContentRef.value = streamingState.regularContent;
				}

				chatStore.updateMessage(tempMessage.tempId!, { content: accumulatedContentRef.value });
			}

			// Handle Anthropic-style tool events
			if (parsedData.tool_start) {
				console.log('Tool started:', parsedData.tool_start);

				// Skip if this tool ID was already processed (e.g., from OpenAI format)
				if (!streamingState.processedToolIds.has(parsedData.tool_start.id)) {
					streamingState.toolPositions.push(accumulatedContentRef.value.length);

					streamingState.currentToolCall = {
						id: parsedData.tool_start.id,
						type: 'function',
						function: {
							name: parsedData.tool_start.name,
							arguments: null,
							result: null
						}
					};

					const currentMetadata = tempMessage.metadata || {};
					currentMetadata.tool_positions = [...streamingState.toolPositions];
					chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
				}
			}

			if (parsedData.tool_input_update && streamingState.currentToolCall) {
				streamingState.currentToolCall.function.arguments = JSON.stringify(
					parsedData.tool_input_update
				);
			}

			if (parsedData.tool_call) {
				console.log('Tool call completed:', parsedData.tool_call);

				if (
					streamingState.currentToolCall &&
					!streamingState.processedToolIds.has(streamingState.currentToolCall.id)
				) {
					streamingState.currentToolCall.function.arguments = JSON.stringify(
						parsedData.tool_call.input
					);
					streamingState.toolCalls.push(streamingState.currentToolCall);
					streamingState.processedToolIds.add(streamingState.currentToolCall.id);

					const currentMetadata = tempMessage.metadata || {};
					currentMetadata.tool_calls = [...streamingState.toolCalls];
					currentMetadata.tool_positions = [...streamingState.toolPositions];
					chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
				}
			}

			if (parsedData.tool_result) {
				console.log('Tool result received');

				// For Anthropic format, update the last tool call with result
				if (streamingState.toolCalls.length > 0) {
					const lastToolCall = streamingState.toolCalls[streamingState.toolCalls.length - 1];

					// Only update if it doesn't already have a result (avoid overwriting OpenAI results)
					if (!lastToolCall.function.result) {
						let parsedResult;
						try {
							parsedResult =
								typeof parsedData.tool_result === 'string'
									? JSON.parse(parsedData.tool_result)
									: parsedData.tool_result;
						} catch (e) {
							parsedResult = parsedData.tool_result;
						}

						lastToolCall.function.result = parsedResult;

						const currentMetadata = tempMessage.metadata || {};
						currentMetadata.tool_calls = [...streamingState.toolCalls];
						currentMetadata.tool_positions = [...streamingState.toolPositions];
						chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
					}
				}

				streamingState.currentToolCall = null;
			}

			// Handle metadata updates
			if (parsedData.metadata) {
				// Merge with existing metadata to preserve tool calls
				const currentMetadata = tempMessage.metadata || {};
				const merged = { ...currentMetadata, ...parsedData.metadata };

				// Preserve tool calls if they exist
				if (currentMetadata.tool_calls) {
					merged.tool_calls = currentMetadata.tool_calls;
				}
				if (currentMetadata.tool_positions) {
					merged.tool_positions = currentMetadata.tool_positions;
				}

				chatStore.updateMessage(tempMessage.tempId!, { metadata: merged });
			}

			// Handle usage stats
			if (parsedData.usage) {
				const currentMetadata = tempMessage.metadata || {};
				currentMetadata.usage = parsedData.usage;
				chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
			}

			// Handle errors
			if (parsedData.error) {
				console.error('Stream error:', parsedData.error);
				const currentMetadata = tempMessage.metadata || {};
				currentMetadata.error = parsedData.error;
				chatStore.updateMessage(tempMessage.tempId!, { metadata: currentMetadata });
			}
		};
	}

	private async getChatHistory(sessionId: string, windowSize: number = 3): Promise<any[]> {
	if (sessionId !== get(chatStore).currentSessionId) {
		console.error(
			`Session mismatch. Current: ${get(chatStore).currentSessionId}, Requested: ${sessionId}`
		);
		return [];
	}
	let attempts = 0;
	while (get(chatStore).isLoadingMessages && attempts++ < 30) {
		await new Promise((r) => setTimeout(r, 100));
	}

	const messages = get(chatStore).messages;
	const sessionMessages = messages.filter((m) => m.role !== 'system');
	const historyMessages = sessionMessages.slice(0, -1);

	console.log(`getChatHistory: ${historyMessages.length} history messages (excluding current)`);
	const recentMessages = historyMessages.slice(-(windowSize * 2));

	return recentMessages.map((msg) => {
		const apiMsg: any = {
			role: msg.role,
			content: msg.content
		};

		// Handle user messages with images
		if (msg.role === 'user' && msg.metadata?.hasImage && Array.isArray(msg.content)) {
			const settings = get(settingsStore);
			
			// Extract text content from the message
			const textContent = msg.content
				.filter((item: any) => item.type === 'text')
				.map((item: any) => item.text)
				.join('\n');

			// For providers that don't support images or to optimize tokens
			const shouldRemoveImage = 
				!['openai', 'anthropic'].includes(settings.provider) ||
				(msg.metadata?.imageInfo?.size && msg.metadata.imageInfo.size > 1024 * 1024);

			if (shouldRemoveImage) {
				// Keep only text content
				apiMsg.content = textContent || '[Image removed from history]';
			} else {
				// For supported providers with reasonable image sizes
				// Remove base64 data to save tokens - just keep text reference
				apiMsg.content = msg.content.map((item: any) => {
					if (item.type === 'text') {
						return item;
					} else if (item.type === 'image' || item.type === 'image_url') {
						// Replace with lightweight reference
						return {
							type: 'text',
							text: `[Image: ${msg.metadata?.imageInfo?.filename || 'unnamed'}]`
						};
					}
					return item;
				});
				
				// If we end up with just image references, convert to simple text
				const hasActualText = apiMsg.content.some((item: any) => 
					item.type === 'text' && item.text && !item.text.startsWith('[Image:')
				);
				
				if (!hasActualText) {
					apiMsg.content = textContent || '[Previous image in conversation]';
				}
			}
		}

		// Handle assistant tool calls
		if (msg.role === 'assistant' && msg.metadata?.tool_calls?.length) {
			apiMsg.tool_calls = msg.metadata.tool_calls.map((tc: any) => ({
				id: tc.id,
				type: tc.type,
				function: {
					name: tc.function.name,
					arguments: tc.function.arguments
				}
			}));
		}

		return apiMsg;
	})
	.filter(msg => msg.content || msg.tool_calls);
}
	private async handleMessage(query: string, messageInputComponent: any): Promise<void> {
		const settings = get(settingsStore);
		chatStore.setStreaming(settings.streaming);

		// Use an object to allow the stream handler to modify the accumulated content
		const accumulatedContentRef = { value: '' };

		try {
			if (!this.currentSessionId) throw new Error('No active session found');

			let apiMessages: any[] = [{ role: 'system', content: settings.systemMessage }];

			// Get chat history - but skip if thinking is enabled
			const isThinkingEnabled = settings.provider === 'anthropic' && settings.enableThinking;
			let historyMessages: any[] = [];

			console.log('Thinking check:', {
				provider: settings.provider,
				enableThinking: settings.enableThinking,
				isThinkingEnabled
			});

			if (!isThinkingEnabled) {
				historyMessages = await this.getChatHistory(
					this.currentSessionId,
					(settings as any).contextWindowSize || 3
				);
				apiMessages.push(...historyMessages);
			} else {
				console.log('Skipping chat history due to thinking mode');
			}

			// Handle current message with image support
			const stagedFile = messageInputComponent?.messageService?.stagedFile;
			let hasImage = false;

			if (stagedFile?.type === 'image' && stagedFile.preview) {
				console.log('Image detected, formatting special message');
				hasImage = true;
				try {
					const formattedImageMessage =
						await messageInputComponent.messageService.formatMessageWithImage(
							settings.provider,
							query
						);
					if (formattedImageMessage) {
						// Simply add the formatted message to existing apiMessages
						// (which already has system message and optionally history)
						apiMessages.push(formattedImageMessage);
					}
				} catch (imageError) {
					console.error('Error formatting image message:', imageError);
					apiMessages.push({ role: 'user', content: query });
				}
			} else {
				apiMessages.push({ role: 'user', content: query });
			}

			const tempMessage = createMessage(this.currentSessionId, 'assistant', '', null);
			chatStore.addMessage(tempMessage);

			const request: any = {
				messages: apiMessages,
				model: settings.model,
				provider: settings.provider,
				api_key: settings.apiKey,
				base_url: settings.baseUrl,
				stream: settings.streaming,
				temperature: settings.temperature,
				top_p: settings.top_p,
				max_tokens: settings.max_tokens,
				presence_penalty: settings.presence_penalty,
				frequency_penalty: settings.frequency_penalty,
				n: settings.n,
				top_k: settings.top_k
			};

			if (settings.selectedTools?.length > 0) {
				request.tools = settings.selectedTools;
			}

			// Add thinking parameter if using anthropic provider
			if (settings.provider === 'anthropic' && settings.enableThinking) {
				request.thinking = {
					type: 'enabled',
					budget_tokens: settings.thinking_budget_tokens || 10000
				};
			}

			if (settings.provider === 'openai' && settings.reasoning_effort !== undefined) {
				const isOModel = settings.model && /^o\d+(-.*)?$/i.test(settings.model);
				if (isOModel) {
					request.reasoning_effort = settings.reasoning_effort;
				}
			}

			console.log('Sending request to API:', {
				model: request.model,
				provider: request.provider,
				messageCount: request.messages.length,
				historyIncluded: historyMessages.length,
				hasImage: hasImage,
				tools: request.tools,
				thinking: request.thinking,
				reasoning_effort: request.reasoning_effort
			});

			// Create stream handler if streaming is enabled
			const streamHandler = settings.streaming
				? this.createStreamHandler(tempMessage, accumulatedContentRef)
				: undefined;

			const result = await routeChatCompletion(request as ChatCompletionRequest, streamHandler);

			if (!settings.streaming) {
				const content = result.choices?.[0]?.message?.content || result.response || '';
				const metadata = result.metadata || null;
				chatStore.updateMessage(tempMessage.tempId!, { content, metadata });
				const savedMessage = await addMessage({
					role: 'assistant',
					chat_session_id: this.currentSessionId,
					content,
					metadata,
					tempId: tempMessage.tempId,
					created_at: new Date()
				});
				chatStore.updateMessage(tempMessage.tempId!, { id: savedMessage.id });
			} else {
				const currentMessage = get(chatStore).messages.find(
					(m: Message) => m.tempId === tempMessage.tempId
				);
				if (!currentMessage) throw new Error('Failed to find current message');
				const savedMessage = await addMessage({
					role: 'assistant',
					chat_session_id: this.currentSessionId,
					content: accumulatedContentRef.value, // Use the ref value
					metadata: currentMessage.metadata || null,
					tempId: tempMessage.tempId,
					created_at: new Date()
				});
				chatStore.updateMessage(tempMessage.tempId!, { id: savedMessage.id });
			}
		} catch (error) {
			console.error('Error in message handling:', error);
			this.handleError(this.currentSessionId!, error);
		} finally {
			chatStore.setGeneratingMessage(false);
			chatStore.setStreaming(false);
		}
	}

	private handleError(sessionId: string, error: unknown): void {
		const errorMessage = createMessage(
			sessionId,
			'system',
			'An error occurred while processing your message. Please try again.'
		);
		chatStore.addMessage(errorMessage);
		addMessage(errorMessage);
		chatStore.setGeneratingMessage(false);
		chatStore.setStreaming(false);
	}

	selectChat(sessionId: string) {
		selectChat(sessionId);
	}

	deleteSession(deletedSessionId: string) {
		console.log(`Handling delete for session ${deletedSessionId}`);
		chatStore.update((state) => {
			console.log('Current state:', state);
			const newState = {
				...state,
				sessions: state.sessions.filter((s) => s.id !== deletedSessionId),
				currentSessionId:
					state.currentSessionId === deletedSessionId ? null : state.currentSessionId,
				messages: state.currentSessionId === deletedSessionId ? [] : state.messages
			};
			console.log('New state:', newState);
			return newState;
		});

		if (deletedSessionId === get(chatStore).currentSessionId) {
			const sessions = get(chatStore).sessions;
			if (sessions.length > 0) {
				selectChat(sessions[0].id);
			} else {
				chatStore.setCurrentSessionId(null);
				chatStore.setMessages([]);
			}
		}
	}

	async createNewChat(newSession: ChatSession) {
		console.log('Handling create new chat event', newSession);
		chatStore.update((state) => ({
			...state,
			sessions: [newSession, ...state.sessions],
			currentSessionId: newSession.id,
			messages: [],
			isLoadingMessages: false
		}));
		console.log('Chat store updated with new chat');
	}

	updateSession(updatedSession: ChatSession) {
		console.log(`Handling update for session ${updatedSession.id}`, updatedSession);
		chatStore.updateSessionName(updatedSession.id, updatedSession.name || '');
	}

	updateSettings(settingsUpdate: Partial<Settings>) {
		settingsStore.update(settingsUpdate);
	}

	loadMoreMessages() {
		if (this.hasMoreMessages) {
			loadMoreMessages();
		}
	}
}

export const picoLLMService = new PicoLLMService();
