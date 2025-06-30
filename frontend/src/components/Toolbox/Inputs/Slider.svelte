<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Tooltip from '../Icons/Tooltip.svelte';

	const dispatch = createEventDispatcher<{
		input: number;
		change: number;
	}>();

	export let label: string;
	export let value: number;
	export let min: number;
	export let max: number;
	export let step = 1;
	export let disabled = false;
	export let tooltip = '';

	let internalValue = value;
	let isEditing = false;
	let inputValue = '';
	let sliderContainer: HTMLDivElement;

	$: isInteger = step >= 1;
	$: displayPrecision = isInteger ? 0 : -Math.floor(Math.log10(step));
	$: percentage = ((internalValue - min) / (max - min)) * 100;
	$: formattedValue = internalValue.toFixed(displayPrecision);

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		internalValue = parseFloat(target.value);
		dispatch('input', internalValue);
	}

	function handleChange() {
		const formattedValue = isInteger
			? Math.round(internalValue)
			: Number(internalValue.toFixed(displayPrecision));
		value = Math.max(min, Math.min(max, formattedValue));
		dispatch('change', value);
	}

	function startEditing() {
		if (!disabled) {
			isEditing = true;
			inputValue = formattedValue;
			setTimeout(() => {
				const input = document.getElementById(`${label}-input`) as HTMLInputElement;
				if (input) {
					input.focus();
					input.select();
				}
			}, 0);
		}
	}

	function handleValueKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			startEditing();
		}
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			commitEdit();
		} else if (event.key === 'Escape') {
			isEditing = false;
		}
	}

	function handleInputBlur() {
		commitEdit();
	}

	function commitEdit() {
		const newValue = parseFloat(inputValue);
		if (!isNaN(newValue) && newValue >= min && newValue <= max) {
			internalValue = newValue;
			handleChange();
		}
		isEditing = false;
	}
</script>

<div class="slider" class:disabled bind:this={sliderContainer}>
	<div class="header">
		<div class="label-wrap">
			<label for={label}>{label}</label>
			{#if tooltip}
				<div class="tooltip-wrap">
					<Tooltip />
					<div class="tooltip-box">{tooltip}</div>
				</div>
			{/if}
		</div>
		{#if isEditing}
			<input
				id="{label}-input"
				type="number"
				class="value-input"
				bind:value={inputValue}
				on:blur={handleInputBlur}
				on:keydown={handleInputKeydown}
				{min}
				{max}
				{step}
				{disabled}
			/>
		{:else}
			<button
				type="button"
				class="value-btn"
				on:click={startEditing}
				on:keydown={handleValueKeydown}
				{disabled}
				aria-label="Click to edit value"
			>
				{formattedValue}
			</button>
		{/if}
	</div>

	<input
		type="range"
		id={label}
		bind:value={internalValue}
		on:input={handleInput}
		on:change={handleChange}
		aria-label={`${label} slider`}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={internalValue}
		{min}
		{max}
		{step}
		style="--p: {percentage}%"
		{disabled}
	/>
</div>

<style>
	.slider {
		--primary: #007aff;
		--track: #3a3a3a;
		--text: #a0a0a0;
		--thumb-size: 14px;
		--track-height: 3px;
		margin-bottom: 1rem;
	}

	.slider.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.slider.disabled .label-wrap {
		opacity: 0.6;
	}

	.slider.disabled .value-btn,
	.slider.disabled .value-input {
		color: var(--text);
		opacity: 0.6;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		gap: 1rem;
	}

	.label-wrap {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	label {
		color: var(--text);
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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

	.value-btn,
	.value-input {
		color: var(--primary);
		font-weight: 600;
		font-size: 0.875rem;
		text-align: right;
		min-width: 3.5rem;
		flex-shrink: 0;
	}

	.value-btn {
		background: none;
		border: 1px solid transparent;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.value-input {
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--primary);
		border-radius: 4px;
		background: white;
		width: 4.5rem;
	}

	.value-input:focus {
		outline: none;
		box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
	}

	.value-input::-webkit-outer-spin-button,
	.value-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	input[type='range'] {
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		width: 100%;
		height: var(--track-height);
		background: transparent;
		outline: none;
		margin: 0;
		padding: 0.25rem 0;
		cursor: pointer;
	}
	input[type='range']::-webkit-slider-runnable-track {
		width: 100%;
		height: var(--track-height);
		background: linear-gradient(
			to right,
			var(--primary) 0%,
			var(--primary) var(--p),
			var(--track) var(--p),
			var(--track) 100%
		);
		border-radius: 1.5px;
	}

	input[type='range']::-moz-range-track {
		width: 100%;
		height: var(--track-height);
		background: var(--track);
		border-radius: 1.5px;
	}

	input[type='range']::-moz-range-progress {
		background: var(--primary);
		height: var(--track-height);
		border-radius: 1.5px;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: var(--thumb-size);
		height: var(--thumb-size);
		background: #fff;
		border: 2px solid var(--primary);
		border-radius: 50%;
		cursor: pointer;
		margin-top: calc((var(--thumb-size) - var(--track-height)) / -2);
		transition: transform 0.1s ease;
	}

	input[type='range']::-moz-range-thumb {
		width: var(--thumb-size);
		height: var(--thumb-size);
		background: #fff;
		border: 2px solid var(--primary);
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.1s ease;
		border: 2px solid var(--primary);
	}

	input[type='range']:hover::-webkit-slider-thumb {
		transform: scale(1.1);
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
	}

	input[type='range']:hover::-moz-range-thumb {
		transform: scale(1.1);
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
	}

	input[type='range']:active::-webkit-slider-thumb,
	input[type='range']:focus::-webkit-slider-thumb {
		transform: scale(1.2);
		box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
	}

	input[type='range']:active::-moz-range-thumb,
	input[type='range']:focus::-moz-range-thumb {
		transform: scale(1.2);
		box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
	}

	/* Focus visible for accessibility */
	input[type='range']:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* Disabled state */
	input[type='range']:disabled {
		cursor: not-allowed;
	}

	input[type='range']:disabled::-webkit-slider-thumb {
		cursor: not-allowed;
		transform: none;
		background: #e5e5e5;
		border-color: var(--track);
		box-shadow: none;
	}

	input[type='range']:disabled::-moz-range-thumb {
		cursor: not-allowed;
		transform: none;
		background: #e5e5e5;
		border-color: var(--track);
		box-shadow: none;
	}

	input[type='range']:disabled::-webkit-slider-runnable-track {
		cursor: not-allowed;
		background: var(--track);
	}

	input[type='range']:disabled::-moz-range-track {
		cursor: not-allowed;
		background: var(--track);
	}

	input[type='range']:disabled::-moz-range-progress {
		background: #5a5a5a;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.header {
			gap: 0.5rem;
		}

		label {
			font-size: 0.8125rem;
		}

		.value-btn,
		.value-input {
			font-size: 0.8125rem;
			min-width: 3rem;
		}

		.value-input {
			width: 4rem;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		input[type='range']::-webkit-slider-thumb {
			border-width: 3px;
		}

		input[type='range']::-moz-range-thumb {
			border-width: 3px;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		* {
			transition-duration: 0.01ms !important;
		}
	}
</style>