import { BACKEND_URL } from '$lib/constants/global.constants';
import { ollamaProgress } from '$lib/stores/ollama-progress';
import type { ModelType } from '$lib/types/global';
import type { OllamaProgressStatus } from '$lib/types/ollama';

// =====================================================
// HELPER FUNCTIONS (Internal use only)
// =====================================================

/**
 * Initializes the progress tracking for a new download
 */
function initializeDownload(): void {
  ollamaProgress.startDownload();
  ollamaProgress.updateProgress({
    status: 'pulling manifest',
    completed: 0,
    total: 0
  });
}

/**
 * Reports an error in the progress tracking
 */
function reportError(error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  const isVersionError = errorMessage.includes('version') || errorMessage.includes('download');
  
  ollamaProgress.updateProgress({
    status: 'error',
    message: errorMessage,
    isVersionError
  });
}

/**
 * Processes a single line of progress data
 */
function processProgressLine(line: string): void {
  try {
    const progressData = JSON.parse(line) as OllamaProgressStatus;
    
    // Check for version error in streaming updates
    if (progressData.status === 'error' && progressData.message?.includes('version')) {
      throw new Error(progressData.message);
    }
    
    ollamaProgress.updateProgress(progressData);
  } catch (e) {
    console.error('Error parsing progress data:', e, line);
  }
}

/**
 * Processes streaming updates from the model pull response
 */
async function processStreamingUpdates(response: Response): Promise<void> {
  if (!response.body) return;
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      // Process any remaining data in buffer
      if (buffer.trim()) {
        processProgressLine(buffer);
      }
      break;
    }
    
    // Decode the chunk and add to buffer
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    
    // Process complete JSON objects in buffer
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      
      if (line) {
        processProgressLine(line);
      }
    }
  }
}

// =====================================================
// PUBLIC API (Maintains original function signatures)
// =====================================================

/**
 * Pulls an Ollama model from the API
 * This function handles streaming progress updates and version errors
 */
export async function pullOllamaModel(modelName: string): Promise<ModelType[]> {
  try {
    console.log(`Pulling Ollama model: ${modelName}`);
    
    // Reset any previous errors and start download
    initializeDownload();

    // Request model pull
    const response = await fetch(`${BACKEND_URL}/v1/models/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: modelName })
    });

    // Handle version check error specifically (412 Precondition Failed)
    if (response.status === 412) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Ollama version update required');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to pull model: ${response.status} - ${errorText}`);
    }

    // Process streaming updates
    await processStreamingUpdates(response);

    // Fetch the updated model list
    return await fetchOllamaModels();
    
  } catch (error) {
    console.error('Error pulling Ollama model:', error);
    reportError(error);
    return [];
  }
}

/**
 * Fetches the list of available Ollama models
 */
export async function fetchOllamaModels(): Promise<ModelType[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/v1/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}


/**
 * Deletes an Ollama model from the backend using RESTful approach
 * @param modelName The name of the model to delete
 * @returns A promise that resolves to the updated list of models after deletion
 */
export async function deleteOllamaModel(modelName: string): Promise<ModelType[]> {
  try {
    console.log(`Deleting Ollama model: ${modelName}`);
    
    // Use RESTful DELETE request with model name in the URL path
    const response = await fetch(`${BACKEND_URL}/v1/models/ollama/${encodeURIComponent(modelName)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 404) {
        throw new Error(`Model '${modelName}' not found`);
      }
      
      const errorText = await response.text();
      throw new Error(`Failed to delete model: ${response.status} - ${errorText}`);
    }

    // Parse and log success response
    const result = await response.json();
    console.log(`Delete result: ${result.message}`);
    
    // Fetch the updated model list after deletion
    return await fetchOllamaModels();
    
  } catch (error) {
    console.error('Error deleting Ollama model:', error);
    throw error;
  }
}
