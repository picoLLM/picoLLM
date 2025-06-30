<script lang="ts">
	import { Loader2 } from 'lucide-svelte';

	export let progress: {
		status: string;
		message: string;
		current?: number;
		total?: number;
		dataset?: number;
		total_datasets?: number;
	};
</script>

<div class="progress-container">
	<div class="progress-status">
		{progress.message || 'Building collection...'}
	</div>
	{#if progress.status === 'inserting' && progress.total && progress.current}
		<div class="progress-bar">
			<div
				class="progress-fill"
				style="width: {(progress.current / progress.total) * 100}%"
			/>
		</div>
		<div class="progress-text">
			{Math.round((progress.current / progress.total) * 100)}% ({progress.current}
			/ {progress.total})
			{#if progress.dataset && progress.total_datasets}
				<br />
				Dataset {progress.dataset} of {progress.total_datasets}
			{/if}
		</div>
	{:else if progress.status === 'loading' || progress.status === 'creating'}
		<div class="progress-status-secondary">
			<Loader2 class="animate-spin" size={16} />
			<span>{progress.message}</span>
		</div>
	{/if}
</div>

<style>
	.progress-container {
		margin-bottom: 1rem;
		padding: 1rem;
		background-color: #2a2a2a;
		border-radius: 4px;
	}

	.progress-status {
		color: #fff;
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
	}

	.progress-bar {
		height: 4px;
		background-color: #333;
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 0.25rem;
	}

	.progress-fill {
		height: 100%;
		background-color: #007aff;
		transition: width 0.3s ease;
	}

	.progress-text {
		color: #a0a0a0;
		font-size: 0.75rem;
		text-align: right;
	}

	.progress-status-secondary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #a0a0a0;
		font-size: 0.875rem;
	}

	:global(.animate-spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>