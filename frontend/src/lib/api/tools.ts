import { BACKEND_URL } from '$lib/constants/global.constants';

export interface ToolPayload {
	name: string;
	description: string;
	code: string;
	parameters: Record<string, any>;
	required_params: string[];
	allow_network: boolean;
}

export interface ToolResponse {
	success: boolean;
	message?: string;
	detail?: string;
}

export interface AvailableToolsResponse {
	tools: Record<string, any>;
}

export async function fetchAvailableTools(): Promise<Record<string, any>> {
	const res = await fetch(`${BACKEND_URL}/tools`);
	if (!res.ok) throw new Error(`Failed to fetch tools: ${res.status}`);
	const data: AvailableToolsResponse = await res.json();
	return data.tools || {};
}

export async function registerTool(payload: ToolPayload): Promise<ToolResponse> {
	const res = await fetch(`${BACKEND_URL}/tools/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	const data = await res.json();

	if (!res.ok) {
		throw new Error(data.detail || data.message || 'Failed to register tool');
	}

	if (!data.success) {
		throw new Error(data.message || 'Failed to register tool');
	}

	return data;
}

export async function deleteTool(toolName: string): Promise<void> {
  console.log('Deleting tool with name:', toolName); // Debug log
  
  const response = await fetch(`${BACKEND_URL}/tools/${toolName}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Delete tool error response:', error); // Debug log
    throw new Error(error.detail || 'Failed to delete tool');
  }
}
