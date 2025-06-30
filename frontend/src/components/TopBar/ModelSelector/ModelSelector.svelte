<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { Search, ChevronDown, Download } from 'lucide-svelte';

	// Store imports
	import { settingsStore } from '$lib/stores/settings';
	import {
		modelSelectorStore as store,
		filteredModels,
		selectedProvider,
		isDownloadable,
		providers,
		searchTerm as storeSearchTerm
	} from '$lib/stores/model-selector';

	// Logic imports
	import * as ms from '$lib/features/search/model-selector';

	// Component imports
	import OllamaPullProgress from './OllamaPullProgress.svelte';
	import ModelItem from './ModelItem.svelte';

	// Type imports
	import type { ProviderType } from '$lib/types/global';
	import type { ModelType } from '$lib/types/models';
	import { ProviderEnum } from '$lib/types/global';

	// Props
	export let placeholder = 'Enter model name';

	// DOM references
	let searchInput: HTMLInputElement;
	let searchContainer: HTMLDivElement;
	let downloadButton: HTMLButtonElement;

	// State
	let localSearchTerm = '';
	let focusIndex = -1;
	let hoverIndex = -1;
	let menuOpenIndex = -1;
	let isRefreshing = false;
	let saveTimeout: ReturnType<typeof setTimeout>;

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		providerChange: { provider: ProviderType; baseUrl: string };
	}>();

	// Reactive
	$: ({ currentModels, isModelDropdownOpen: modelOpen, isProviderDropdownOpen: providerOpen } = $store);
	$: highlightIndex = hoverIndex >= 0 ? hoverIndex : focusIndex;
	$: modelOpen && (focusIndex = hoverIndex = menuOpenIndex = -1);

	// Utils
	const stopEvent = (e: Event) => (e.preventDefault(), e.stopPropagation());
	const isEnterOrSpace = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';
	
	// Navigation
	const navigate = (dir: number, from = focusIndex) => {
		const max = $filteredModels.length + ($isDownloadable ? 0 : -1);
		focusIndex = Math.max(-1, Math.min(from + dir, max));
		
		if (focusIndex === -1) {
			searchInput.focus();
		} else if (focusIndex === $filteredModels.length && $isDownloadable) {
			setTimeout(() => downloadButton?.focus(), 0);
		} else {
			setTimeout(() => {
				const el = document.getElementById(`model-option-${focusIndex}`);
				el?.querySelector('button')?.focus();
			}, 0);
		}
	};

	// Save handler with debouncing
	const saveModel = () => {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			if (localSearchTerm) {
				settingsStore.setModel(localSearchTerm);
				settingsStore.saveToLocalStorage();
			}
		}, 300);
	};

	// Handlers
	const handleInput = (e: Event) => {
		localSearchTerm = (e.target as HTMLInputElement).value;
		settingsStore.setModel(localSearchTerm);
		$settingsStore.provider === ProviderEnum.vllm && ms.refreshVllmModels(localSearchTerm);
		store.toggleModelDropdown(true);
		saveModel();
	};

	const selectModel = (e: CustomEvent<ModelType>) => {
		const name = ms.getModelIdentifier(e.detail);
		localSearchTerm = name;
		ms.handleModelSelection(name);
		saveModel();
	};

	const handleProviderChange = async (value: ProviderEnum) => {
		const result = await ms.changeProvider(value);
		dispatch('providerChange', { provider: value, baseUrl: result.baseUrl });
		result.models.length && ms.handleModelSelection(ms.getModelIdentifier(result.models[0]));
	};

	const handleKeydown = (e: KeyboardEvent) => {
		const actions: Record<string, () => void> = {
			'Escape': () => store.closeDropdowns(),
			'ArrowDown': () => (stopEvent(e), modelOpen ? navigate(1) : store.toggleModelDropdown(true)),
			'ArrowUp': () => modelOpen && (stopEvent(e), navigate(-1)),
			'Enter': () => modelOpen && (stopEvent(e), ms.handleModelEnterKey(localSearchTerm, highlightIndex, $filteredModels, $isDownloadable))
		};
		
		actions[e.key]?.();
	};

	const handleModelNavigate = (e: CustomEvent<{ dir: number; from: number }>) => {
		navigate(e.detail.dir, e.detail.from);
	};

	const pullModel = async (name: string) => {
		store.toggleModelDropdown(false);
		const models = await ms.handleOllamaModelPull(name);
		if (models.length) {
			store.setCurrentModels(models);
			const model = models.find(m => ms.getModelIdentifier(m) === name) || models[0];
			localSearchTerm = ms.getModelIdentifier(model);
			ms.handleModelSelection(localSearchTerm);
			saveModel();
		}
	};

	const deleteModel = async (e: CustomEvent<ModelType>) => {
		const model = e.detail;
		const name = ms.getModelIdentifier(model);
		menuOpenIndex = -1;
		
		try {
			await ms.handleModelDeletion(name);
			!isRefreshing && (isRefreshing = true, await ms.refreshModels($settingsStore.provider), isRefreshing = false);
			
			if (localSearchTerm === name) {
				currentModels.length 
					? selectModel(new CustomEvent('select', { detail: currentModels[0] }))
					: (localSearchTerm = '', settingsStore.setModel(''), settingsStore.saveToLocalStorage());
			}
		} catch (error) {
			console.error(`Failed to delete model ${name}:`, error);
		}
	};

	const handleDownloadKeydown = (e: KeyboardEvent) => {
		const actions: Record<string, () => void> = {
			'ArrowUp': () => (stopEvent(e), navigate(-1, $filteredModels.length)),
			'Escape': () => (stopEvent(e), store.closeDropdowns(), searchInput.focus())
		};
		actions[e.key]?.();
	};

	// A11y compliant handlers
	const handleDownloadMouseEnter = () => hoverIndex = $filteredModels.length;
	const handleDownloadMouseLeave = () => hoverIndex = -1;
	const handleDownloadFocus = () => hoverIndex = $filteredModels.length;
	const handleDownloadBlur = () => hoverIndex = -1;

	// Lifecycle
	onMount(() => {
		localSearchTerm = ms.initializeFromLocalStorage();
		ms.refreshModels($settingsStore.provider);
		
		const handleClickOutside = (e: MouseEvent) => {
			!searchContainer?.contains(e.target as Node) && (store.closeDropdowns(), menuOpenIndex = -1);
		};
		
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			clearTimeout(saveTimeout);
		};
	});

	// Sync with store when not typing
	$: if ($storeSearchTerm !== localSearchTerm && !searchInput?.matches(':focus')) {
		localSearchTerm = $storeSearchTerm || '';
	}
</script>

<div class="search-container" role="search" aria-label="Search models" bind:this={searchContainer}>
	<div class="input-wrapper">
		<div class="model-selection">
			<div class="icon-wrapper" aria-hidden="true">
				<Search size={16} class="search-icon" />
			</div>
			<input
				bind:this={searchInput}
				bind:value={localSearchTerm}
				on:input={handleInput}
				on:focus={() => store.toggleModelDropdown(true)}
				on:keydown={handleKeydown}
				type="text"
				class="search-input"
				{placeholder}
				aria-label={placeholder}
				role="combobox"
				aria-expanded={modelOpen}
				aria-controls="model-listbox"
				aria-autocomplete="list"
				aria-activedescendant={highlightIndex >= 0 ? `model-option-${highlightIndex}` : undefined}
			/>
			<button
				class="dropdown-toggle"
				on:click={() => store.toggleModelDropdown()}
				aria-haspopup="listbox"
				aria-expanded={modelOpen}
				aria-label="Select model"
			>
				<ChevronDown size={16} class="dropdown-icon" aria-hidden="true" />
			</button>
		</div>
		<div class="provider-selection">
			<button
				class="dropdown-toggle provider-toggle"
				on:click={() => store.toggleProviderDropdown()}
				aria-haspopup="listbox"
				aria-expanded={providerOpen}
				aria-label="Select provider"
			>
				{#if $selectedProvider}
					<img src={$selectedProvider.icon} alt={$selectedProvider.label} class="provider-icon" />
				{/if}
				<span class="provider-label">{$selectedProvider?.label}</span>
				<ChevronDown size={16} class="dropdown-icon" aria-hidden="true" />
			</button>
		</div>
	</div>

	<div class="progress-wrapper">
		<OllamaPullProgress />
	</div>

	{#if modelOpen && ($filteredModels.length > 0 || $isDownloadable)}
		<ul class="dropdown-menu model-menu" role="listbox" id="model-listbox">
			{#each $filteredModels as model, i (ms.getModelIdentifier(model))}
				<ModelItem
					{model}
					index={i}
					active={highlightIndex === i}
					menuOpen={menuOpenIndex === i}
					{focusIndex}
					searchTerm={localSearchTerm}
					on:select={selectModel}
					on:delete={deleteModel}
					on:menuToggle={(e) => menuOpenIndex = menuOpenIndex === e.detail ? -1 : e.detail}
					on:navigate={handleModelNavigate}
					on:hover={(e) => hoverIndex = e.detail}
					on:hoverOut={() => hoverIndex = -1}
				/>
			{/each}

			{#if $isDownloadable}
				{@const i = $filteredModels.length}
				<li role="option" class="model-item downloadable" id={`model-option-${i}`} aria-selected={false}>
					<button
						bind:this={downloadButton}
						class="model-button download-button"
						class:active={highlightIndex === i}
						on:click={() => pullModel(localSearchTerm)}
						on:keydown={handleDownloadKeydown}
						on:mouseenter={handleDownloadMouseEnter}
						on:mouseleave={handleDownloadMouseLeave}
						on:focus={handleDownloadFocus}
						on:blur={handleDownloadBlur}
						tabindex={focusIndex === i ? 0 : -1}
					>
						<div class="model-info">
							<span class="model-name">Pull {localSearchTerm}</span>
						</div>
						<div class="model-meta">
							<Download size={16} />
						</div>
					</button>
				</li>
			{/if}
		</ul>
	{/if}

	{#if providerOpen}
		<ul class="dropdown-menu provider-menu" role="listbox">
			{#each providers as provider}
				<li
					role="option"
					aria-selected={provider.value === $settingsStore.provider}
					tabindex="0"
					on:click={() => handleProviderChange(provider.value)}
					on:keydown={(e) => isEnterOrSpace(e) && (stopEvent(e), handleProviderChange(provider.value))}
					class:active={provider.value === $settingsStore.provider}
				>
					<img src={provider.icon} alt={provider.label} class="provider-icon" />
					<span class="provider-label">{provider.label}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	@import '../../../lib/styles/components/TopBar/model-selector.css';
</style>