
export interface FileInfo {
  file: File;
  type: 'image' | 'document';
  preview?: string;
}

export interface MessagePayload {
  text: string;
  file?: File;
  fileType?: 'image' | 'document';
}

export interface MessageEvents {
  sendMessage: { text: string; hasImage: boolean };
  uploadFile: { file: File };
}

export class MessageService {
    private dragCounter = 0;
    private _isDragging = false;
    private _stagedFile: FileInfo | null = null;
    private _inputMessage = '';
  
    // Getters
    get isDragging(): boolean {
      return this._isDragging;
    }
  
    get stagedFile(): FileInfo | null {
      return this._stagedFile;
    }
  
    get inputMessage(): string {
      return this._inputMessage;
    }
  
    // Setters
    set inputMessage(value: string) {
      this._inputMessage = value;
    }
}  