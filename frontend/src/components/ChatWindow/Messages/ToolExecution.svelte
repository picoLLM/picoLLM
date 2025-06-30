<script lang="ts">
	import type { ToolCall } from '$lib/types/global';
	import Calculator from '$components/Toolbox/Icons/Calculator.svelte';
	import Search from '$components/Toolbox/Icons/Search.svelte';
	import Code from '$components/Toolbox/Icons/Code.svelte';

	export let toolCall: ToolCall;
	export let isActive: boolean = false;

	type Status = 'starting' | 'executing' | 'pending' | 'complete' | 'error';

	// Parse function arguments safely
	$: toolInput = (() => {
		try {
			return toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;
		} catch {
			return null;
		}
	})();

	// Format tool name for display
	$: displayName =
		toolCall.function?.name
			?.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ') || 'Tool';

	// Keep the actual function name for display
	$: functionName = toolCall.function?.name || 'tool';

	// Determine current status
	$: currentStatus = ((): Status => {
		if (isActive) {
			if (!toolInput) return 'starting';
			if (!toolCall.function?.result) return 'executing';
		}
		// Check for error status
		const result = toolCall.function?.result as any;
		if (result?.status === 'error') return 'error';

		return toolCall.function?.result ? 'complete' : 'pending';
	})();

	// Format arguments as comma-separated values
	$: formattedArgs = (() => {
		if (!toolInput) return '';

		// Get all argument values in order
		const args = Object.entries(toolInput).map(([_, value]) => {
			// Format different types appropriately
			if (typeof value === 'string') {
				// Truncate long strings
				const str = value.length > 30 ? value.substring(0, 27) + '...' : value;
				return `"${str}"`;
			}
			if (typeof value === 'object' && value !== null) {
				return Array.isArray(value) ? `[${value.length}]` : `{...}`;
			}
			return String(value);
		});

		return args.join(', ');
	})();



	// Get icon based on tool name
	$: toolIcon = (() => {
		const name = toolCall.function?.name?.toLowerCase() || '';

		if (name.includes('search') || name.includes('web')) {
			return 'search';
		} else if (name.includes('calc') || name.includes('math')) {
			return 'calculator';
		}
		// Default to code icon for all other functions (including user-defined)
		return 'code';
	})();
</script>

<div class="tool-card {currentStatus} {isActive ? 'active' : ''}">
	<div
		class="tool-emblem {currentStatus === 'starting' || currentStatus === 'executing'
			? 'pulsing'
			: ''}"
	>
		{#if toolIcon === 'search'}
			<Search/>
		{:else if toolIcon === 'calculator'}
			<Calculator/>
		{:else}
			<Code/>
		{/if}
	</div>

	<div class="tool-content">
		<div class="tool-header">
			<span class="tool-name">{displayName}</span>
		</div>

		{#if formattedArgs}
			<div class="tool-detail">
				<span class="detail-value function-style">
					{functionName}({formattedArgs})
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	@import '../../../lib/styles/components/ChatWindow/Messages/tool-execution.css';
</style>