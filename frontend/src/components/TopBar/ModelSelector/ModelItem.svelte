<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { MoreVertical, Trash2 } from 'lucide-svelte';
	import type { ModelType } from '$lib/types/models';
	import * as ms from '$lib/features/search/model-selector';

	// Props
	export let model: ModelType;
	export let index: number;
	export let active = false;
	export let menuOpen = false;
	export let focusIndex: number;
	export let searchTerm: string;

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		select: ModelType;
		delete: ModelType;
		menuToggle: number;
		navigate: { dir: number; from: number };
		hover: number;
		hoverOut: void;
	}>();

	// Derived
	$: info = ms.formatModelDisplay(model);
	$: isSelected = ms.getModelIdentifier(model) === searchTerm;
	$: metaType = getMetaType(model);

	// Utils
	const stopEvent = (e: Event) => (e.preventDefault(), e.stopPropagation());
	const isEnterOrSpace = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';
	const getMetaType = (model: ModelType) =>
		ms.isOllamaModel(model) ? 'ollama' :
		ms.isVllmModel(model) ? 'vllm' :
		ms.isOpenAIModel(model) ? 'openai' : null;

	// Handlers
	const handleKeydown = (e: KeyboardEvent) => {
		const actions: Record<string, () => void> = {
			'ArrowDown': () => (stopEvent(e), dispatch('navigate', { dir: 1, from: index })),
			'ArrowUp': () => (stopEvent(e), dispatch('navigate', { dir: -1, from: index })),
			'Escape': () => stopEvent(e)
		};
		actions[e.key]?.();
	};

	const toggleMenu = (e: Event) => {
		stopEvent(e);
		dispatch('menuToggle', index);
	};

	const handleDelete = (e: Event) => {
		stopEvent(e);
		dispatch('delete', model);
	};

	// A11y compliant handlers
	const handleMouseEnter = () => dispatch('hover', index);
	const handleMouseLeave = () => dispatch('hoverOut');
	const handleFocus = () => dispatch('hover', index);
	const handleBlur = () => dispatch('hoverOut');
</script>

<li role="option" class="model-item" class:selected={isSelected} aria-selected={isSelected} id={`model-option-${index}`}>
	<button
		on:click={() => dispatch('select', model)}
		on:keydown={handleKeydown}
		on:mouseenter={handleMouseEnter}
		on:mouseleave={handleMouseLeave}
		on:focus={handleFocus}
		on:blur={handleBlur}
		class="model-button"
		class:active
		aria-current={isSelected}
		tabindex={focusIndex === index ? 0 : -1}
	>
		<div class="model-info">
			<span class="model-name">
				{info.name}
				{#if info.params}
					<span class="model-params">
						({info.params}{#if info.quantization}, {info.quantization}{/if})
					</span>
				{/if}
			</span>
		</div>
		<div class="model-meta">
			{#if metaType === 'ollama'}
				<span class="model-size">{info.size}</span>
				<div class="model-actions">
					<button
						class="model-menu-button"
						on:click={toggleMenu}
						on:keydown={(e) => isEnterOrSpace(e) && toggleMenu(e)}
						aria-label="Model options"
						aria-haspopup="true"
						aria-expanded={menuOpen}
					>
						<MoreVertical size={16} />
					</button>
					{#if menuOpen}
						<div class="model-menu-dropdown" role="menu">
							<button
								class="model-menu-item delete-button"
								on:click={handleDelete}
								on:keydown={(e) => isEnterOrSpace(e) && handleDelete(e)}
								role="menuitem"
								tabindex="0"
							>
								<Trash2 size={14} />
								<span>Delete</span>
							</button>
						</div>
					{/if}
				</div>
			{:else if metaType === 'vllm'}
				<span class="model-meta-info">
					<span class="model-owner">{info.owner}</span>
					{#if info.modelLen}<span class="model-length">{info.modelLen}</span>{/if}
				</span>
			{:else if metaType === 'openai'}
				<span class="model-meta-info">
					{#if info.created}<span class="model-date">{info.created}</span>{/if}
					{#if info.owner}<span class="model-owner">{info.owner}</span>{/if}
				</span>
			{/if}
		</div>
	</button>
</li>

<style>
	@import '../../../lib/styles/components/TopBar/model-item.css';
</style>