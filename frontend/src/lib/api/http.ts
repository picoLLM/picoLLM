export async function sendRequest(
	url: string,
	data: any,
	handleStream?: (chunk: any) => any,
	isStreaming = false
  ): Promise<any> {
	const headers = {
	  'Content-Type': 'application/json',
	  ...(isStreaming && { Accept: 'text/event-stream' })
	};
	
	console.log('HTTP Request body:', JSON.stringify(data));
	
	try {
	  const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(data)
	  });
	  
	  if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	  }
	  
	  if (isStreaming && handleStream) {
		return handleStreamingResponse(response, handleStream);
	  }
	  
	  return response.json();
	} catch (error) {
	  console.error('Request failed:', error);
	  throw error;
	}
  }
export async function handleStreamingResponse(
	response: Response,
	handleStream: (chunk: any) => any
): Promise<void> {
	if (!response.body) {
		throw new Error('No response body received');
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n\n');

			// Keep the last partial line in buffer
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (!line.trim() || !line.startsWith('data: ')) continue;

				const data = line.slice(6).trim();
				if (data === '[DONE]') break;

				try {
					const parsedData = JSON.parse(data);
					handleStream(parsedData);
				} catch (e) {
					console.warn('Skipping malformed chunk:', e);
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}
