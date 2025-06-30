// lib/services/fastapi/api.service.ts
import { BACKEND_URL } from '$lib/constants/global.constants';
import type { ChatCompletionRequest } from '$lib/types/chat';
import { ProviderEnum } from '$lib/types/global';
import { providerService } from '$lib/services/providers/provider.service';

// Export the ChatCompletionError from the types module
export { ChatCompletionError } from '$lib/types/provider';

// Export utility functions
export { prepareNumericParameters, prepareProviderParameters } from '$lib/utils/request';

export async function routeChatCompletion(config: ChatCompletionRequest, handleStream?: any) {
  // Deep clone to avoid modifying the original
  const configCopy = JSON.parse(JSON.stringify(config));
  
  console.group('routeChatCompletion');
  console.log('Provider:', configCopy.provider);
  console.log('Messages:', configCopy.messages.map((msg: any) => ({
    role: msg.role,
    contentType: typeof msg.content,
    isArray: Array.isArray(msg.content),
    contentSample: Array.isArray(msg.content)
      ? msg.content.map((item: any) => item.type)
      : (typeof msg.content === 'string'
        ? msg.content.substring(0, 30) + '...'
        : JSON.stringify(msg.content).substring(0, 30) + '...')
  })));
  console.log('Request parameters:', configCopy);
  console.groupEnd();
  
  const provider = providerService.getStrategy(configCopy);
  return provider.createChatCompletion(configCopy, handleStream);
}

// KEEPING THE ORIGINAL FUNCTIONS FOR BACKWARD COMPATIBILITY
export async function createAnthropicChatCompletion(
  config: ChatCompletionRequest,
  handleStream?: (chunk: any) => void
): Promise<any> {
  const provider = providerService.getStrategy({ ...config, provider: ProviderEnum.anthropic });
  return provider.createChatCompletion(config, handleStream);
}

export async function createOpenAIChatCompletion(
  config: ChatCompletionRequest,
  handleStream?: (chunk: any) => void
): Promise<any> {
  const provider = providerService.getStrategy(config);
  return provider.createChatCompletion(config, handleStream);
}

export async function updateChatSessionTitle(sessionId: string, newTitle: string): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/chat-sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newTitle })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update chat session title: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error updating chat session title:', error);
    throw error;
  }
}

export { sendRequest } from './http';