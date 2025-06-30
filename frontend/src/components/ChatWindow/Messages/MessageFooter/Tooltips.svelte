<script lang="ts">
	import { Info } from 'lucide-svelte';
	
	export let snippet: string;
	export let index: number;
	export let active: boolean = false;
	export let locked: boolean = false;
	
	export let onShow: (index: number) => void;
	export let onHide: () => void;
	export let onToggle: (e: MouseEvent, index: number) => void;
</script>

<button
	class="tooltip-trigger"
	on:mouseenter={() => onShow(index)}
	on:mouseleave={onHide}
	on:click={(e) => onToggle(e, index)}
	type="button"
>
	<Info size={12} />
</button>

{#if active}
	<div class="search-tooltip" class:locked>
		<div class="tooltip-content">
			{snippet}
		</div>
		{#if locked}
			<div class="tooltip-hint">Click info icon or outside to close</div>
		{/if}
	</div>
{/if}

<style>
@import '../../../../lib/styles/components/ChatWindow/MessageFooter/tooltips.css';
</style>