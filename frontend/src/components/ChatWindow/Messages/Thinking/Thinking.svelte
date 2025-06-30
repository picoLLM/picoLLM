<script lang="ts">
	export let content: string = '';
	export let isStreaming: boolean = false;
	export let theme: 'light' | 'dark' = 'dark';

	let isExpanded = true;
	let contentElement: HTMLDivElement;

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	$: contentLines = !isStreaming && content ? content.split('\n').length : 0;
</script>

<div class="thinking-wrapper" class:light={theme === 'light'}>
	<button
		class="thinking-toggle"
		class:expanded={isExpanded}
		on:click={toggleExpanded}
		aria-expanded={isExpanded}
		aria-label="Toggle thinking content"
		type="button"
	>
		<svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
			<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
		
		<span class="thinking-label">
			{#if isStreaming}
				<span class="pulse-dot"></span>
				Thinking...
			{:else}
				Thought process
			{/if}
		</span>
		
		{#if contentLines > 0}
			<span class="line-count">{contentLines} lines</span>
		{/if}
	</button>

	<div class="thinking-content-wrapper" class:collapsed={!isExpanded}>
		<div 
			class="thinking-content"
			class:hidden={!isExpanded}
			bind:this={contentElement}
		>
			{@html content}
		</div>
	</div>
</div>

<style>
	@import '../../../../lib/styles/components/ChatWindow/Messages/thinking.css';
</style>