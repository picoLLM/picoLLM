<!-- src/routes/configure/components/CompactField.svelte -->
<script lang="ts">
	import { HelpCircle } from 'lucide-svelte';

	export let label: string;
	export let tooltip: string = '';
	export let required: boolean = false;
</script>

<div class="field-container">
	<div class="field-header">
		<label class="field-label" class:required>
			{label}
		</label>
		{#if tooltip}
			<div class="tooltip" data-tooltip={tooltip}>
				<HelpCircle size={12} />
			</div>
		{/if}
	</div>
	<div class="field-content">
		<slot />
	</div>
</div>

<style>
	.field-container {
		margin-bottom: 0.875rem;
	}

	.field-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.375rem;
	}

	.field-label {
		font-size: 0.75rem;
		color: #999;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.field-label.required::after {
		content: '*';
		color: #ef4444;
		margin-left: 0.125rem;
	}

	.tooltip {
		display: inline-flex;
		align-items: center;
		color: #666;
		cursor: help;
		position: relative;
		padding: 0.125rem;
	}

	.tooltip:hover {
		color: #999;
	}

	.tooltip:hover::after {
		content: attr(data-tooltip);
		position: absolute;
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-left: 0.5rem;
		background-color: #2a2a2a;
		color: #fff;
		padding: 0.375rem 0.625rem;
		border-radius: 4px;
		font-size: 0.75rem;
		width: max-content;
		max-width: 200px;
		z-index: 100;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		border: 1px solid #333;
		pointer-events: none;
	}

	.field-content {
		width: 100%;
	}

	:global(.field-content .styled-input-container) {
		margin-bottom: 0;
	}

	:global(.field-content input) {
		height: 36px;
		font-size: 0.875rem;
	}
</style>