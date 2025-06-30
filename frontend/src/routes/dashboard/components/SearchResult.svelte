<!-- src/routes/configure/components/SearchResult.svelte -->
<script lang="ts">
	import type { SearchResult } from '$lib/api/qdrant';

	export let result: SearchResult;
	export let index: number;

	let expanded = false;

	function toggleExpanded() {
		expanded = !expanded;
	}

	$: truncatedContent = result.content.length > 200 
		? result.content.substring(0, 200) + '...'
		: result.content;

	$: displayContent = expanded ? result.content : truncatedContent;
	$: showToggle = result.content.length > 200;
</script>

<div class="result-card">
	<div class="result-header">
		<span class="result-index">#{index}</span>
		<span class="result-score">{result.score.toFixed(4)}</span>
	</div>
	
	<div class="result-content" class:expanded>
		{displayContent}
		{#if showToggle}
			<button class="expand-toggle" on:click={toggleExpanded}>
				{expanded ? 'Show less' : 'Show more'}
			</button>
		{/if}
	</div>

	{#if Object.keys(result.metadata).length > 0}
		<div class="result-metadata">
			{#each Object.entries(result.metadata) as [key, value]}
				<span class="metadata-item" title="{key}: {value}">
					<span class="metadata-key">{key}:</span>
					<span class="metadata-value">{value}</span>
				</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.result-card {
		background-color: #242424;
		border: 1px solid #333;
		border-radius: 8px;
		padding: 0.875rem;
		margin-bottom: 0.5rem;
		transition: all 0.2s ease;
	}

	.result-card:hover {
		border-color: #444;
		background-color: #2a2a2a;
	}

	.result-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.result-index {
		color: #007aff;
		font-weight: 600;
		font-size: 0.813rem;
	}

	.result-score {
		background-color: #007aff;
		color: #fff;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.result-content {
		color: #ccc;
		font-size: 0.813rem;
		line-height: 1.5;
		margin-bottom: 0.5rem;
		position: relative;
		word-break: break-word;
	}

	.result-content.expanded {
		max-height: none;
	}

	.expand-toggle {
		display: inline-block;
		margin-left: 0.25rem;
		color: #007aff;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
		text-decoration: underline;
	}

	.expand-toggle:hover {
		color: #0056b3;
	}

	.result-metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.metadata-item {
		background-color: #1a1a1a;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		max-width: 200px;
		overflow: hidden;
	}

	.metadata-key {
		color: #999;
		flex-shrink: 0;
	}

	.metadata-value {
		color: #ccc;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>