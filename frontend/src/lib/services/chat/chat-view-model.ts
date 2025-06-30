import { derived } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import type { ChatViewModel } from '$lib/types/ui';

export const createChatViewModel = () => {
  const viewModel = derived<typeof chatStore, ChatViewModel>(
    chatStore,
    ($chatStore) => {
      const { messages, isGeneratingMessage, isLoadingMessages } = $chatStore;
      const lastMessage = messages[messages.length - 1];
      const isStreaming = isGeneratingMessage && lastMessage?.role === 'assistant';
      
      return {
        messages,
        isGeneratingMessage,
        isLoadingMessages,
        lastMessage,
        isStreaming
      };
    }
  );

  return viewModel;
};
