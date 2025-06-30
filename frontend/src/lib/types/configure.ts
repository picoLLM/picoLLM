// Define interfaces for our data structures
export interface CollectionBuildRequest {
    dataset_names: string[];
    load_from_disk: boolean;
    split: string;
    text_field: string;
    batch_size: number;
    use_quantization: boolean;
    use_matryoshka: boolean;
  }

export interface ProgressUpdate {
    event: string;
    data: number;
  }

export interface BuildProgress {
	status: 'initializing' | 'loading' | 'creating' | 'processing' | 'inserting' | 'completed' | 'completed_dataset' | 'error' | 'info';
	message: string;
	timestamp?: string;
	current?: number;
	total?: number;
	dataset?: number;
	total_datasets?: number;
	processed?: number;
	total_processed?: number;
	size?: number;
}

export type BuildStatus = 'pending' | 'active' | 'error';