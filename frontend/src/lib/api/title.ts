import { BACKEND_URL } from '$lib/constants/global.constants';
import type { Settings } from '$lib/types/settings';
import { chatStore } from '$lib/stores/chat';
import { isOModel } from '$lib/services/settings/tool-settings-menu';
import { sendRequest } from './api';

export function is1BModel(modelName?: string): boolean {
  if (!modelName) return false;
  return /1b/i.test(modelName.toLowerCase());
}

export class TitleService {
  static async generateAndUpdateTitle(
    sessionId: string,
    firstMessage: string,
    settings: Partial<Settings>
  ): Promise<string> {
    console.log('Generating title for session:', sessionId);
    try {
      const systemMessage =
        'You are a title generation assistant. Your task is to create a brief, descriptive title (2-4 words) based on the users first message. Never explain or answer the message - only generate a title that captures its main topic';
      
      const isAnthropicProvider = settings.provider === 'anthropic';
      const endpoint = isAnthropicProvider 
        ? `${BACKEND_URL}/v1/messages` 
        : `${BACKEND_URL}/v1/chat/completions`;
      
      // Create a copy of settings to avoid modifying the original
      const titleSettings = { ...settings };
      
      // For O models, always use gpt-4o-mini for title generation
      if (!isAnthropicProvider && isOModel(settings.model)) {
        titleSettings.model = 'gpt-4o-mini';
        console.log('Using gpt-4o-mini for title generation');
      }
      
      // Check if we're using a 1B model
      const is1BModelType = !isAnthropicProvider && is1BModel(settings.model);
      
      // For 1B models, we need to modify the message format
      if (is1BModelType) {
        console.log('Detected 1B model, using simplified request format');
        // Create a message that includes the instruction in the user prompt
        const enhancedUserMessage = `Generate a brief title (2-4 words) that captures the essence of this message: ${firstMessage}`;
        
        // Use the standard request building function but with modified inputs
        const request = this.buildTitleRequest(enhancedUserMessage, titleSettings, '');
        
        // For 1B models, we need to remove the system message
        if (request.messages && request.messages.length > 1 && request.messages[0].role === 'system') {
          request.messages = [request.messages[1]]; // Keep only the user message
        }
        
        console.log('1B model request:', JSON.stringify(request, null, 2));
        
        const result = await sendRequest(endpoint, request, undefined, false);
        console.log('Raw title response:', result);
        
        const title = this.extractTitleFromResponse(result, isAnthropicProvider);
        console.log('Extracted title:', title);
        
        if (title && title !== 'New Conversation') {
          const cleanTitle = this.cleanTitle(title);
          await this.updateTitle(sessionId, cleanTitle);
          return cleanTitle;
        }
      } else {
        // Standard approach for non-1B models
        const request = this.buildTitleRequest(firstMessage, titleSettings, systemMessage);
        console.log('Title generation request:', JSON.stringify(request, null, 2));
        
        const result = await sendRequest(endpoint, request, undefined, false);
        console.log('Raw title response:', result);
        
        const title = this.extractTitleFromResponse(result, isAnthropicProvider);
        console.log('Extracted title:', title);
        
        if (title && title !== 'New Conversation') {
          const cleanTitle = this.cleanTitle(title);
          await this.updateTitle(sessionId, cleanTitle);
          return cleanTitle;
        }
      }
      
      throw new Error('Empty title generated');
    } catch (error) {
      console.error('Failed to generate or update title:', error);
      return this.handleTitleError(sessionId);
    }
  }

  private static buildTitleRequest(
    firstMessage: string,
    settings: Partial<Settings>,
    systemMessage: string
  ): any {
    const isAnthropicProvider = settings.provider === 'anthropic';
    const isOModelType = isOModel(settings.model);
    const systemRole = isOModelType ? 'developer' : 'system';
    
    // Anthropic-specific request format
    if (isAnthropicProvider) {
      return {
        model: settings.model,
        provider: settings.provider,
        messages: [{ role: 'user', content: firstMessage }],
        system: systemMessage,
        temperature: 0.3,
        stream: false,
        max_tokens: 20
      };
    }
    
    // Standard request format for other providers
    const request: any = {
      messages: [
        { role: systemRole, content: systemMessage },
        { role: 'user', content: firstMessage }
      ],
      model: settings.model,
      provider: settings.provider,
      temperature: 0.3,
      stream: false,
      max_tokens: 10
    };

    // Add API key and base URL for Ollama
    if (settings.provider === 'ollama') {
      request.base_url = settings.baseUrl;
    }

    return request;
  }

  private static extractTitleFromResponse(result: any, isAnthropicProvider: boolean): string {
    // Handle Anthropic response format
    if (isAnthropicProvider && result.content && result.content.length > 0) {
      if (Array.isArray(result.content) && result.content[0].text) {
        return result.content[0].text.trim();
      } else if (typeof result.content === 'string') {
        return result.content.trim();
      }
    }
    
    // Handle different response formats from various providers
    if (result.response) {  // Ollama format
      return result.response.trim();
    }
    
    if (result.answer) {  // Custom format
      return result.answer.trim();
    }
    
    if (result.choices?.[0]?.message?.content) {  // OpenAI format
      return result.choices[0].message.content.trim();
    }
    
    if (result.content) {  // Fallback format
      return result.content.trim();
    }
    
    return '';
  }

  private static cleanTitle(title: string): string {
    // Remove quotes and ensure proper formatting
    let cleanedTitle = title.replace(/^["']|["']$/g, '').trim();
    
    // Remove common prefixes LLMs might add
    cleanedTitle = cleanedTitle
      .replace(/^(title:|here's a title:|suggested title:)/i, '')
      .trim();
    
    // Limit length for UI display
    if (cleanedTitle.length > 50) {
      cleanedTitle = cleanedTitle.substring(0, 47) + '...';
    }
    
    return cleanedTitle || 'New Conversation';
  }

  private static async updateTitle(sessionId: string, title: string): Promise<void> {
    await Promise.all([
      this.updateChatSessionTitle(sessionId, title),
      new Promise<void>((resolve) => {
        chatStore.updateSessionName(sessionId, title);
        resolve();
      })
    ]);
  }

  private static async updateChatSessionTitle(sessionId: string, newTitle: string): Promise<void> {
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

  private static async handleTitleError(sessionId: string): Promise<string> {
    const defaultTitle = 'New Conversation';
    await this.updateTitle(sessionId, defaultTitle);
    return defaultTitle;
  }
}