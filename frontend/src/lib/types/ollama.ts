export interface OllamaProgressStatus {
    status: string;
    digest?: string;
    total?: number;
    completed?: number;
    message?: string;
    isVersionError?: boolean;
  }
  
  
export interface OllamaProgressState {
  isDownloading: boolean;
  progressStatus: OllamaProgressStatus | null;
}