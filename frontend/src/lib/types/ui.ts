export interface ChatWindowProps {
    currentSessionId: string | null;
    isSettingsPanelOpen: boolean;
  }
  
  export interface ChatViewModel {
    messages: any[];
    isGeneratingMessage: boolean;
    isLoadingMessages: boolean;
    lastMessage: any;
    isStreaming: boolean;
  }
  