<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Tooltip from '../Icons/Tooltip.svelte';

	const dispatch = createEventDispatcher<{
		change: string;
	}>();

	export let label: string;
	export let value: string = '';
	export let options: Array<{ value: string; label: string }>;
	export let disabled = false;
	export let tooltip = '';
	export let allowDeselect = false;

	let labelElement: HTMLSpanElement;
	let buttonGroup: HTMLDivElement;
	let fontSize = 0.875; // Default font size in rem

	function handleClick(optionValue: string) {
		if (!disabled) {
			// If allowDeselect is true and clicking the active value, emit empty string
			if (allowDeselect && value === optionValue) {
				value = '';
			} else {
				value = optionValue;
			}
			dispatch('change', value);
		}
	}

	function calculateFontSize() {
		if (!buttonGroup) return;

		// Find the longest label among options
		const longestLabel = options.reduce((longest, opt) => 
			opt.label.length > longest.length ? opt.label : longest, 
			options[0]?.label || ''
		);

		// Calculate based on character count
		const charCount = Math.max(longestLabel.length, label.length / 2);
		
		if (charCount > 10) {
			fontSize = 0.75; // Smaller font for long labels
		} else if (charCount > 8) {
			fontSize = 0.8125;
		} else {
			fontSize = 0.875; // Default
		}
	}

	onMount(() => {
		calculateFontSize();
	});

	$: if (options || label) {
		calculateFontSize();
	}
</script>

<div class="selector" class:disabled>
	<div class="header">
		<div class="label-wrap">
			<span class="label-text" bind:this={labelElement} style="font-size: {fontSize}rem">{label}</span>
			{#if tooltip}
				<div class="tooltip-wrap">
					<Tooltip />
					<div class="tooltip-box">{tooltip}</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="button-group" bind:this={buttonGroup}>
		{#each options as option}
			<button
				type="button"
				class="option-button"
				class:active={value === option.value}
				on:click={() => handleClick(option.value)}
				{disabled}
				aria-label="{option.label} {label}"
				style="font-size: {fontSize}rem"
			>
				{option.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.selector {
		--primary: #007aff;
		--track: #3a3a3a;
		--text: #a0a0a0;
		--hover: #4a4a4a;
		margin-bottom: 1rem;
	}

	.selector.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.header {
		margin-bottom: 0.5rem;
	}

	.label-wrap {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}

	.label-text {
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: font-size 0.2s ease;
	}

	.tooltip-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}

	.tooltip-wrap :global(svg) {
		width: 14px;
		height: 14px;
		opacity: 0.5;
		cursor: help;
		transition: opacity 0.2s;
	}

	.tooltip-box {
		position: absolute;
		left: 50%;
		bottom: 100%;
		transform: translateX(-50%);
		background: #333;
		color: white;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		white-space: nowrap;
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.2s;
		margin-bottom: 0.5rem;
		pointer-events: none;
		z-index: 10;
	}

	.tooltip-wrap:hover .tooltip-box {
		opacity: 1;
		visibility: visible;
	}

	.tooltip-box::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 4px solid transparent;
		border-top-color: #333;
	}

	.button-group {
		display: flex;
		width: 100%;
		border: 1px solid var(--track);
		border-radius: 4px;
		overflow: hidden;
	}

	.option-button {
		flex: 1;
		padding: 0.5rem 0.5rem;
		background: transparent;
		border: none;
		border-right: 1px solid var(--track);
		color: var(--text);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: center;
		min-height: 36px;
		position: relative;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.option-button:last-child {
		border-right: none;
	}

	.option-button:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.05);
	}

	.option-button.active {
		background: var(--primary);
		color: white;
	}

	.option-button.active:hover:not(:disabled) {
		background: #0066d6;
	}

	.option-button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
		z-index: 1;
	}

	@media (max-width: 480px) {
		.label-text {
			font-size: 0.8125rem;
		}

		.option-button {
			font-size: 0.8125rem;
			padding: 0.4rem 0.5rem;
			min-height: 32px;
		}
	}
</style>