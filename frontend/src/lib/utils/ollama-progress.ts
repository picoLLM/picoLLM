import type { OllamaProgressStatus } from '$lib/types/ollama';

// Format helpers
export function formatSize(bytes: number | undefined): string {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Progress display logic
export function shouldShowProgress(status: OllamaProgressStatus | null, isDownloading: boolean): boolean {
    if (!status || !status.status) return false;
    return isDownloading;
}

export function getStatusMessage(status: OllamaProgressStatus | null): string {
    if (!status) return 'Initializing...';

    switch (status.status) {
        case 'pulling manifest':
            return 'Pulling manifest...';
        case 'success':
            return 'Download complete!';
        case 'error':
            // Special handling for version update errors
            if (status.isVersionError) {
                return 'Ollama update required';
            }
            return status.message?.includes('{"detail":') 
                ? 'Failed to pull model. Check model name.' 
                : (status.message || 'Download failed');
        case 'verifying sha256 digest':
            return 'Verifying download...';
        case 'writing manifest':
            return 'Writing manifest...';
        case 'removing any unused layers':
            return 'Cleaning up...';
        default:
            if (status.status.startsWith('pulling') && status.total && status.completed) {
                return `Downloading: ${getProgressPercent(status)}%`;
            }
            return status.status || 'Processing...';
    }
}

export function getProgressPercent(status: OllamaProgressStatus | null, indeterminateProgress: number = 5): number {
    if (!status) return indeterminateProgress;
    
    if (status.status === 'pulling manifest') {
        return indeterminateProgress;
    }
    
    if (status.status === 'verifying sha256 digest') return 95;
    if (status.status === 'writing manifest') return 97;
    if (status.status === 'removing any unused layers') return 99;
    if (status.status === 'success') return 100;
    if (status.status === 'error') return 100;
    
    // Use actual progress if available
    if (status.total && status.completed) {
        return Math.round((status.completed / status.total) * 100);
    }
    
    return indeterminateProgress;
}

export function hasProgressData(status: OllamaProgressStatus | null): boolean {
    return !!status?.total && !!status?.completed;
}

export function isVersionError(status: OllamaProgressStatus | null): boolean {
    return !!status?.isVersionError;
}