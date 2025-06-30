// src/routes/configure/services/build.service.ts
import { BACKEND_URL } from '$lib/constants/global.constants';
import { buildStore } from '../stores/build';
import type { BuildProgress } from '$lib/types/configure';

interface BuildRequest {
	collection_name: string;
	dataset_names: string[];
	load_from_disk: boolean;
	split: string;
	text_field: string;
	batch_size: number;
	use_quantization: boolean;
	use_matryoshka: boolean;
}

export async function buildCollection(request: BuildRequest) {
	buildStore.reset();
	buildStore.setBuilding(true);

	try {
		const response = await fetch(`${BACKEND_URL}/collections/build`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'text/event-stream'
			},
			body: JSON.stringify(request)
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.detail || 'Build request failed');
		}

		await processStreamResponse(response);
	} catch (error) {
		console.error('Build error:', error);
		buildStore.setError(error instanceof Error ? error.message : 'Build process failed');
	} finally {
		buildStore.setBuilding(false);
	}
}

async function processStreamResponse(response: Response) {
	const reader = response.body?.getReader();
	if (!reader) throw new Error('Failed to get stream reader');

	const textDecoder = new TextDecoder();
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += textDecoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const dataString = line.slice(6);
					try {
						const data = JSON.parse(dataString) as BuildProgress;
						buildStore.setProgress(data);

						if (data.status === 'completed') {
							buildStore.setBuilding(false);
							// Refresh stats after successful build
							const { statsStore } = await import('../stores/stats');
							statsStore.loadStats();
						} else if (data.status === 'error') {
							buildStore.setError(data.message);
							buildStore.setBuilding(false);
						}
					} catch (error) {
						console.error('Error parsing progress:', error);
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}