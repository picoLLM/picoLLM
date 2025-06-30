// $lib/api/export.ts
import { BACKEND_URL } from '$lib/constants/global.constants';

interface ExportOptions {
  includeMetadata?: boolean;
  includeEmpty?: boolean;
}

export async function exportAllSessions(options: ExportOptions = {}): Promise<void> {
  const params = new URLSearchParams({
    include_metadata: (options.includeMetadata || false).toString(),
    include_empty: (options.includeEmpty || false).toString()
  });
  
  window.location.href = `${BACKEND_URL}/export/chat-sessions/all?${params}`;
}

export async function exportSessions(sessionIds: number[]): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/export/chat-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_ids: sessionIds })
  });
  
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  window.location.href = url;
}