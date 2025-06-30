<script lang="ts">
	import { Globe } from 'lucide-svelte';
	import type { MessageMetadata as MessageMetadataType } from '$lib/types/global';

	export let metadata: MessageMetadataType;
	
	let isExpanded = false;
	
	$: hasWebSearchResults = Boolean(metadata?.web_search?.length);
	$: displayedResults = isExpanded ? metadata.web_search : metadata.web_search?.slice(0, 3);
	$: hasMoreResults = (metadata?.web_search?.length || 0) > 3;
	
	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}
	
	function toggleExpanded(e: MouseEvent) {
		e.stopPropagation();
		isExpanded = !isExpanded;
	}
</script>

{#if hasWebSearchResults && metadata.web_search && displayedResults}
	<div class="web-search-tags">
		{#each displayedResults as webResult}
			<div class="web-search-tag">
				<a
					href={webResult.url}
					target="_blank"
					rel="noopener noreferrer"
					class="tag-content"
					on:click={(e) => e.stopPropagation()}
				>
					<Globe size={10} strokeWidth={2} />
					<span class="tag-title">{truncateText(webResult.title, 20)}</span>
				</a>
			</div>
		{/each}
		{#if hasMoreResults}
			<div class="web-search-tag more-tag">
				<button class="more-button" on:click={toggleExpanded}>
					{#if isExpanded}
						Show less
					{:else}
						+{metadata.web_search.length - 3}
					{/if}
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	@import '../../../../lib/styles/components/ChatWindow/MessageFooter/web-search-tags.css';
</style>