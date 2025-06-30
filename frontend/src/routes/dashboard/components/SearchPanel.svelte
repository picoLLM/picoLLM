<script lang="ts">
	import { Search, Loader2 } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import SearchResult from './SearchResult.svelte';
	import { searchStore } from '../stores/search';
	import { qdrantService } from '$lib/api/qdrant';

	let searchQuery = '';
	let selectedCollection = '';
	let searchTopK = 10;
	let collections: string[] = [];

	onMount(async () => {
		try {
			collections = await qdrantService.getCollections();
			if (collections.length > 0 && !selectedCollection) {
				selectedCollection = collections[0];
			}
		} catch (error) {
			console.error('Failed to load collections:', error);
		}
	});

	async function handleSearch() {
		if (!searchQuery || !selectedCollection) return;

		await searchStore.search({
			collection: selectedCollection,
			query: searchQuery,
			topK: searchTopK
		});
	}
</script>

<div class="panel search-panel">
	<div class="panel-header">
		<Search size={16} />
		<h3>Vector Search</h3>
	</div>

	<div class="panel-content">
		<div class="controls">
			<div class="search-bar">
				<input
					type="text"
					class="input"
					placeholder="Enter your search query..."
					bind:value={searchQuery}
					on:keypress={(e) => e.key === 'Enter' && !$searchStore.isSearching && handleSearch()}
					disabled={$searchStore.isSearching}
				/>
				<button
					class="btn"
					on:click={handleSearch}
					disabled={$searchStore.isSearching || !searchQuery || !selectedCollection}
				>
					{#if $searchStore.isSearching}
						<Loader2 class="spin" size={16} />
					{:else}
						<Search size={16} />
					{/if}
				</button>
			</div>

			<div class="filters">
				<div class="field">
					<label for="col">Collection</label>
					<select id="col" bind:value={selectedCollection}>
						{#each collections as c}
							<option value={c}>{c}</option>
						{/each}
						{#if collections.length === 0}
							<option value="">No collections</option>
						{/if}
					</select>
				</div>
				<div class="field">
					<label for="k">Top K</label>
					<input id="k" type="number" bind:value={searchTopK} min="1" max="100" />
				</div>
			</div>
		</div>

		<div class="results">
			{#if $searchStore.results.length > 0}
				<div class="header">Found {$searchStore.results.length} results</div>
				<div class="list">
					{#each $searchStore.results as result, i}
						<SearchResult {result} index={i + 1} />
					{/each}
				</div>
			{:else if $searchStore.isSearching}
				<div class="empty">
					<Loader2 class="spin" size={24} />
					<p>Searching...</p>
				</div>
			{:else if $searchStore.hasSearched}
				<div class="empty">
					<p>No results found</p>
				</div>
			{:else}
				<div class="empty">
					<Search size={24} />
					<p>Enter a query to search</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.search-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.panel-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		overflow: hidden;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.search-bar {
		display: flex;
		gap: 0.5rem;
	}

	.input {
		flex: 1;
		padding: 0.625rem 0.875rem;
		background: #1e1e1e;
		border: 1px solid #333;
		border-radius: 8px;
		color: #fff;
		font-size: 0.875rem;
	}

	.input:focus {
		outline: none;
		border-color: #007aff;
		background: #242424;
		box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.25);
	}

	.btn {
		padding: 0.625rem 1rem;
		background: #007aff;
		border: none;
		border-radius: 8px;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn:hover:not(:disabled) {
		background: #0056b3;
		transform: translateY(-1px);
	}

	.btn:disabled {
		background: #3a3a3a;
		cursor: not-allowed;
		opacity: 0.7;
	}

	.filters {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		background: #1e1e1e;
		border-radius: 8px;
		border: 1px solid #2a2a2a;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field label {
		font-size: 0.75rem;
		color: #999;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.field select,
	.field input {
		padding: 0.375rem 0.625rem;
		background: #2a2a2a;
		border: 1px solid #333;
		border-radius: 4px;
		color: #fff;
		font-size: 0.813rem;
	}

	.field input {
		width: 80px;
	}

	.results {
		flex: 1;
		background: #1e1e1e;
		border-radius: 8px;
		border: 1px solid #2a2a2a;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.header {
		padding: 0.75rem 1rem;
		background: #242424;
		border-bottom: 1px solid #2a2a2a;
		color: #999;
		font-size: 0.813rem;
		font-weight: 500;
		flex-shrink: 0;
	}

	.list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		min-height: 0;
	}

	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		color: #666;
		padding: 2rem;
	}

	.empty p {
		font-size: 0.875rem;
		margin: 0;
	}

	* {
		transition: none !important;
		animation: none !important;
		transform: none !important;
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
