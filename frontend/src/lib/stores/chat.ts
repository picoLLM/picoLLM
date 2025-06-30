import { writable, derived } from 'svelte/store';
import type { ChatSession, Message } from '../types/global';

const BUFFER_SIZE = 10;

function createChatStore() {
	const { subscribe, update } = writable<{
		sessions: ChatSession[];
		currentSessionId: string | null;
		messages: Message[];
		bufferedMessages: Message[];
		isLoadingMore: boolean;
		isLoadingMessages: boolean;
		hasMoreMessages: boolean;
		isGeneratingMessage: boolean;
		isStreaming: boolean;
	}>({
		sessions: [],
		currentSessionId: null,
		messages: [],
		bufferedMessages: [],
		isLoadingMore: false,
		isLoadingMessages: false,
		hasMoreMessages: true,
		isGeneratingMessage: false,
		isStreaming: false
	});

	return {
		subscribe,
		update,
		setSessions: (sessions: ChatSession[]) => update(s => ({ ...s, sessions })),
		setCurrentSessionId: (id: string | null) =>
			update(s => ({ ...s, currentSessionId: id })),
		setMessages: (messages: Message[]) =>
			update(s => ({
				...s,
				messages,
				bufferedMessages: messages.length > BUFFER_SIZE 
					? messages.slice(-BUFFER_SIZE) 
					: messages
			})),
		addMessage: (message: Message) =>
			update(s => {
				const msgs = [...s.messages, message];
				return {
					...s,
					messages: msgs,
					bufferedMessages: msgs.length > BUFFER_SIZE 
						? msgs.slice(-BUFFER_SIZE) 
						: msgs
				};
			}),
		updateMessage: (messageId: string, updates: Partial<Message>) =>
			update(s => {
				const idx = s.messages.findIndex(m => m.id === messageId || m.tempId === messageId);
				if (idx === -1) return s;
				
				const msgs = s.messages.slice();
				const old = msgs[idx];
				
				msgs[idx] = {
					...old,
					...updates,
					content: updates.content !== undefined ? updates.content : old.content,
					metadata: updates.metadata !== undefined
						? updates.metadata === null
							? null
							: { ...old.metadata, ...updates.metadata }
						: old.metadata
				};

				return {
					...s,
					messages: msgs,
					bufferedMessages: msgs.length > BUFFER_SIZE 
						? msgs.slice(-BUFFER_SIZE) 
						: msgs
				};
			}),
		removeMessage: (messageId: string) =>
			update(s => {
				const msgs = s.messages.filter(m => m.id !== messageId);
				return {
					...s,
					messages: msgs,
					bufferedMessages: msgs.length > BUFFER_SIZE 
						? msgs.slice(-BUFFER_SIZE) 
						: msgs
				};
			}),
		setLoadingMore: (isLoading: boolean) =>
			update(s => ({ ...s, isLoadingMore: isLoading })),
		setLoadingMessages: (isLoading: boolean) =>
			update(s => ({ ...s, isLoadingMessages: isLoading })),
		setHasMoreMessages: (hasMore: boolean) =>
			update(s => ({ ...s, hasMoreMessages: hasMore })),
		setGeneratingMessage: (isGenerating: boolean) =>
			update(s => ({ ...s, isGeneratingMessage: isGenerating })),
		setStreaming: (isStreaming: boolean) => 
			update(s => ({ ...s, isStreaming })),
		updateSessionMessages: (sessionId: string, messages: Message[]) =>
			update(s => ({
				...s,
				sessions: s.sessions.map(session =>
					session.id === sessionId ? { ...session, messages } : session
				)
			})),
		clearMessages: () => 
			update(s => ({ ...s, messages: [], bufferedMessages: [] })),
		updateSessionName: (sessionId: string, newName: string) =>
			update(s => ({
				...s,
				sessions: s.sessions.map(session =>
					session.id === sessionId ? { ...session, name: newName } : session
				)
			}))
	};
}

export const chatStore = createChatStore();
export const currentSession = derived(chatStore, $s =>
	$s.sessions.find(session => session.id === $s.currentSessionId)
);