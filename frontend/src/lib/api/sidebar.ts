// lib/sidebar/sidebar.ts
import type { ChatSession } from '$lib/types/global';
import { BACKEND_URL } from '$lib/constants/global.constants';
import { createNewChat as createNewChatService } from '$lib/api/db';

export class SidebarManager {
  static async renameChatSession(sessionId: string, newName: string): Promise<ChatSession> {
    try {
      const response = await fetch(`${BACKEND_URL}/chat-sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_name: newName })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to rename chat session: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error renaming chat session:', error);
      throw error;
    }
  }
  
  static async deleteChatSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_URL}/chat-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status !== 204) {
        throw new Error(`Failed to delete chat session: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting chat session:', error);
      throw error;
    }
  }
  
  static async createNewChat(): Promise<ChatSession> {
    return await createNewChatService();
  }
  
  static async getChatSessions(): Promise<ChatSession[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/chat-sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get chat sessions: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      return [];
    }
  }
}