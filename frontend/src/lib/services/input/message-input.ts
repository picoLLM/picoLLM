// $lib/services/chat/messages.ts
import type { FileInfo } from '$lib/types/components/message-input';
import type { ChatCompletionRequest, APIMessages } from '$lib/types/chat';
import type { ProviderEnum } from '$lib/types/global';

// Constants
const FILE_SIZE_UNITS = ['Bytes', 'KB', 'MB', 'GB'];
const FILE_SIZE_BASE = 1024;
const DEFAULT_IMAGE_TYPE = 'image/jpeg';
const DEFAULT_IMAGE_MESSAGE = "What's in this image?";

// Type definitions
type MessageContent = Array<Record<string, any>>;
interface ProviderMessageFormat {
  role: 'user';
  content: MessageContent;
}

// Provider message format configurations
const PROVIDER_FORMATS = {
  anthropic: (base64: string, mediaType: string, text: string): MessageContent => [
    {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 }
    },
    { type: 'text', text }
  ],
  default: (base64: string, mediaType: string, text: string): MessageContent => [
    {
      type: 'image_url',
      image_url: { url: `data:${mediaType};base64,${base64}` }
    },
    { type: 'text', text }
  ]
};

export class MessageService {
  private dragCounter = 0;
  private _state = {
    isDragging: false,
    stagedFile: null as FileInfo | null,
    inputMessage: ''
  };

  // Unified getter
  private get<K extends keyof typeof this._state>(key: K): typeof this._state[K] {
    return this._state[key];
  }

  // Public getters
  get isDragging() { return this.get('isDragging'); }
  get stagedFile() { return this.get('stagedFile'); }
  get inputMessage() { return this.get('inputMessage'); }
  set inputMessage(value: string) { this._state.inputMessage = value; }

  // Unified drag handler
  private handleDrag = (type: 'enter' | 'leave' | 'drop') => async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    
    const actions = {
      enter: () => {
        this.dragCounter++;
        this._state.isDragging = true;
      },
      leave: () => {
        this.dragCounter--;
        if (!this.dragCounter) this._state.isDragging = false;
      },
      drop: async () => {
        this._state.isDragging = false;
        this.dragCounter = 0;
        const file = e.dataTransfer?.files?.[0];
        if (file) await this.handleFile(file);
      }
    };
    
    await actions[type]();
  }

  // Public drag handlers
  handleDragEnter = this.handleDrag('enter');
  handleDragLeave = this.handleDrag('leave');
  handleDrop = this.handleDrag('drop');

  // Unified file processor
  private async processFile(file: File, fileName?: string): Promise<boolean> {
    try {
      const namedFile = fileName ? new File([file], fileName, { type: file.type }) : file;
      await this.handleFile(namedFile);
      console.log(`File processed successfully${fileName ? ' from clipboard' : ''}`);
      return true;
    } catch (error) {
      console.error("Error processing file:", error);
      return false;
    }
  }

  // Clipboard handling
  async handleClipboardPaste(e: ClipboardEvent): Promise<boolean> {
    if (this.stagedFile || !e.clipboardData) return false;
    
    const imageItem = Array.from(e.clipboardData.items).find(
      item => item.kind === 'file' && item.type.startsWith('image/')
    );
    
    const file = imageItem?.getAsFile();
    if (!file) return false;
    
    const fileName = file.name || `pasted-image-${Date.now()}.${imageItem!.type.split('/')[1] || 'png'}`;
    return this.processFile(file, fileName);
  }

  // File handling
  async handleFile(file: File): Promise<void> {
    const isImage = file.type.startsWith('image/');
    this._state.stagedFile = {
      file,
      type: isImage ? 'image' : 'document',
      preview: isImage ? await this.createImagePreview(file) : undefined
    };
    console.log(`File staged: ${this._state.stagedFile.type} - ${file.name}`);
  }

  // Image preview creation
  private createImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const result = e.target?.result;
        typeof result === 'string' ? resolve(result) : reject(new Error('Failed to create preview'));
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  }

  // Utilities
  formatFileSize(bytes: number): string {
    if (!bytes) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(FILE_SIZE_BASE));
    return `${(bytes / Math.pow(FILE_SIZE_BASE, i)).toFixed(2)} ${FILE_SIZE_UNITS[i]}`;
  }

  private getBase64FromDataUrl(dataUrl: string): string {
    const [, base64] = dataUrl.split(',');
    return base64 || (console.error("Invalid data URL format"), "");
  }

  // State management
  removeFile = () => { this._state.stagedFile = null; }
  clearInputMessage = () => { this._state.inputMessage = ''; }
  hasValidInput = () => !!(this.inputMessage.trim() || this.stagedFile);

  // Message formatting
  async formatMessageWithImage(provider: ProviderEnum, textContent: string): Promise<ProviderMessageFormat | null> {
    const { stagedFile } = this._state;
    if (stagedFile?.type !== 'image' || !stagedFile.preview) {
      console.error("Cannot format message: invalid image data");
      return null;
    }

    const base64 = this.getBase64FromDataUrl(stagedFile.preview);
    const mediaType = stagedFile.file.type || DEFAULT_IMAGE_TYPE;
    const text = textContent.trim() || DEFAULT_IMAGE_MESSAGE;

    console.log(`Formatting image message for ${provider}`, { mediaType, base64Length: base64.length });

    const formatter = PROVIDER_FORMATS[provider as keyof typeof PROVIDER_FORMATS] || PROVIDER_FORMATS.default;
    return { role: 'user', content: formatter(base64, mediaType, text) };
  }

  async prepareMessagesWithImage(provider: ProviderEnum, messages: APIMessages[]): Promise<APIMessages[]> {
    const imageMessage = await this.formatMessageWithImage(provider, this.inputMessage);
    return imageMessage ? [...messages, imageMessage] : messages;
  }
}