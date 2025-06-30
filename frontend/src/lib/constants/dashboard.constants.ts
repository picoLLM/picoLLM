    import type { BuildStatus } from '$lib/types/configure';
	// Form field descriptions
	export const fieldDescriptions = {
		collectionName: 'The name of the collection you are creating.',
		datasetNames: 'List of dataset names from Hugging Face Hub or local paths if loading from disk. Separate multiple datasets with commas.',
		loadFromDisk: 'Loads dataset from local path instead of Huggingface Hub',
		split: 'Dataset split to use (Default: train)',
		textField: 'The field name in your dataset that contains the text to be processed. Defaults to "text" if not specified.',
		batchSize: 'Number of documents to process at once. Larger batches may be faster but use more memory. Default is 100.',
		useQuantization: 'Builds the collection with uint8 quantization for reduced memory usage and faster search. Recommended for large collections.',
		useMatryoshka: 'Enable matryoshka embeddings for hierarchical representation of vectors. Useful for multi-scale similarity search.'
	};

	// Badge presets with type
	export const badgePresets: Record<BuildStatus, {
		dotColor: string;
		borderColor: string;
		backgroundColor: string;
		textColor: string;
	}> = {
		active: {
			dotColor: '#10B981',
			borderColor: '#064E3B',
			backgroundColor: '#064E3B',
			textColor: '#ffffff'
		},
		pending: {
			dotColor: '#F59E0B',
			borderColor: '#92400E',
			backgroundColor: '#92400E',
			textColor: '#ffffff'
		},
		error: {
			dotColor: '#EF4444',
			borderColor: '#991B1B',
			backgroundColor: '#991B1B',
			textColor: '#ffffff'
		}
	};