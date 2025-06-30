<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { derived, get } from 'svelte/store';

	import Close from '$components/Toolbox/Icons/Close.svelte';
	import Dropdown from '$components/Toolbox/Dropdowns/Dropdown.svelte';
	import Slider from '$components/Toolbox/Inputs/Slider.svelte';
	import StyledTextInput from '$components/Toolbox/Inputs/FlexboxInput.svelte';
	import Toggle from '$components/Toolbox/Inputs/Toggle.svelte';
	import ToolItem from './Tools/ToolItem.svelte';
	import AddToolModal from './AddToolModal.svelte';
	import Selector from '$components/Toolbox/Inputs/Selector.svelte';

	import { settingsStore } from '$lib/stores/settings';
	import {
		getProviderParameters,
		parameterConfigs,
		validateParameterValue
	} from '$lib/constants/params.constants';
	import { ProviderEnum } from '$lib/types/global';
	import type { ParameterConfig } from '$lib/constants/params.constants';

	import {
		shouldShowSystemMessage,
		getSystemMessageLabel,
		shouldShowBaseUrl,
		updateSystemMessageForModel,
		isOModel,
		enforceThinkingConstraints,
		getThinkingModeConstraints,
		applyThinkingConstraints,
		getConstrainedParamValue,
		handleParameterChange,
		toggleThinking,
		toggleTool,
		toggleStreaming,
		processStopSequences,
		handleBaseUrlChange
	} from '$lib/services/settings/tool-settings-menu';

	// Props
	export let isGeneratingMessage = false;

	// Local UI state
	let dropdownStates = {
		parameters: false,
		tools: false
	};
	let showAddToolModal = false;

	let previousProvider: ProviderEnum | string;
	let previousModel: string;

	const dispatch = createEventDispatcher();

	$: showReasoningOptions =
		$settingsStore.provider === ProviderEnum.openai && isOModel($settingsStore.model);

	// Enforce thinking mode constraints reactively
	$: if ($settingsStore.provider === ProviderEnum.anthropic && $settingsStore.enableThinking) {
		enforceThinkingConstraints($settingsStore);
	}

	// Derived stores for cleaner reactivity
	const visibleParameters = derived([settingsStore], ([$settings]) => {
		const params = getProviderParameters($settings.provider);
		return params.filter((p) => {
			if (p.key === 'thinking_budget_tokens') {
				return $settings.provider === ProviderEnum.anthropic && $settings.enableThinking;
			}
			return true;
		});
	});

	const showSystemMessage = derived(settingsStore, ($s) => shouldShowSystemMessage($s.model));
	const systemMessageLabel = derived(settingsStore, ($s) =>
		getSystemMessageLabel($s.model, $s.provider)
	);
	const showBaseUrl = derived(settingsStore, ($s) => shouldShowBaseUrl($s.provider));

	// Event handlers
	const handlers = {
		close: () => dispatch('toggleSettings'),
		updateSettings: () => {
			settingsStore.save();
			dispatch('updateSettings', $settingsStore);
		},

		param: (param: ParameterConfig, value: number) => {
			handleParameterChange(
				param,
				value,
				isGeneratingMessage,
				$settingsStore.provider,
				$settingsStore.enableThinking
			);
			handlers.updateSettings();
		},

		systemMessage: (e: CustomEvent<string>) => {
			settingsStore.setSystemMessage(String(e.detail));
			handlers.updateSettings();
		},

		baseUrl: (e: CustomEvent<string>) => {
			handleBaseUrlChange(e.detail, isGeneratingMessage);
			handlers.updateSettings();
		},

		stopSequences: (e: CustomEvent<string>) => {
			processStopSequences(e.detail, isGeneratingMessage);
			handlers.updateSettings();
		},

		toggleDropdown: (section: 'parameters' | 'tools') => {
			dropdownStates[section] = !dropdownStates[section];
		},

		toggleFeature: async (
			feature: 'streaming' | 'thinking' | 'rag' | 'rerank' | 'automateFilters' | 'agent'
		) => {
			if (feature === 'thinking') {
				await toggleThinking(isGeneratingMessage);
			} else if (feature === 'streaming') {
				toggleStreaming(isGeneratingMessage);
			} else {
				if (!isGeneratingMessage) {
					settingsStore.toggles[feature]();
				}
			}
			handlers.updateSettings();
		},

		toggleTool: (toolName: string) => {
			toggleTool(toolName, isGeneratingMessage);
			handlers.updateSettings();
		},

		openAddTool: () => {
			showAddToolModal = true;
		},

		closeAddTool: () => {
			showAddToolModal = false;
		},

		toolAdded: async (e: CustomEvent<{ name: string }>) => {
			showAddToolModal = false;
			await settingsStore.fetchAvailableTools();
			if (e.detail.name) {
				handlers.toggleTool(e.detail.name);
			}
		},

		reasoningEffort: (e: CustomEvent<string>) => {
			const value = e.detail || undefined;
			settingsStore.setReasoningEffort(value as 'low' | 'medium' | 'high' | undefined);
			handlers.updateSettings();
		},

		reasoningSummary: (e: CustomEvent<string>) => {
			const value = e.detail || undefined;
			settingsStore.setReasoningSummary(value as 'auto' | 'concise' | 'detailed' | undefined);
			handlers.updateSettings();
		}
	};

	// Check if parameter value won't be sent in request
	const isParamOmitted = (param: ParameterConfig): boolean => {
		const value = $settingsStore[param.key];
		const config = parameterConfigs[param.key];

		if (config.optional && config.omitValue !== undefined) {
			if (value === undefined) return true;
			return value === config.omitValue;
		}

		return false;
	};

	// Get display value for slider using business logic
	const getParamValue = (param: ParameterConfig): number => {
		const value = $settingsStore[param.key];
		const config = parameterConfigs[param.key];

		// Use business logic for constrained values
		const constrainedValue = getConstrainedParamValue(
			param,
			value,
			$settingsStore.provider,
			$settingsStore.enableThinking
		);

		if (value === undefined && config.optional && config.omitValue !== undefined) {
			return config.omitValue;
		}

		return constrainedValue;
	};

	// Lifecycle
	onMount(async () => {
		settingsStore.fetchAvailableTools();

		const settings = get(settingsStore);
		previousProvider = settings.provider;
		previousModel = settings.model;

		// Ensure system message is properly formatted on mount
		updateSystemMessageForModel(settings.provider, settings.model, settings.systemMessage);

		// Enforce thinking constraints on mount if needed
		if (settings.provider === ProviderEnum.anthropic && settings.enableThinking) {
			await enforceThinkingConstraints(settings);
		}
	});

	const unsubscribe = settingsStore.subscribe((settings) => {
		if (settings.provider !== previousProvider || settings.model !== previousModel) {
			updateSystemMessageForModel(settings.provider, settings.model, settings.systemMessage);
			previousProvider = settings.provider;
			previousModel = settings.model;
		}
	});

	onDestroy(() => {
		unsubscribe?.();
	});
</script>

<div class="settings-panel">
	<div class="settings-panel-header">
		<h2>Settings</h2>
		<button class="close-button" on:click={handlers.close}>
			<Close />
		</button>
	</div>

	<div class="settings-panel-content">
		{#if $showSystemMessage}
			<StyledTextInput
				label={$systemMessageLabel}
				value={$settingsStore.systemMessage}
				inputType="textarea"
				placeholder={`Enter ${$systemMessageLabel.toLowerCase()}`}
				rows={3}
				on:input={handlers.systemMessage}
				disabled={isGeneratingMessage}
			/>
		{/if}

		<Dropdown
			title="Parameters"
			isOpen={dropdownStates.parameters}
			on:click={() => handlers.toggleDropdown('parameters')}
			disabled={isGeneratingMessage}
		>
			{#if $settingsStore.provider === ProviderEnum.anthropic}
				<div class="parameter-toggle">
					<Toggle
						label="Enable Thinking"
						checked={$settingsStore.enableThinking}
						disabled={isGeneratingMessage}
						on:change={() => handlers.toggleFeature('thinking')}
					/>
				</div>
			{/if}

			{#if showReasoningOptions}
				<Selector
					label="Reasoning Effort"
					value={$settingsStore.reasoning_effort || ''}
					options={[
						{ value: 'low', label: 'Low' },
						{ value: 'medium', label: 'Medium' },
						{ value: 'high', label: 'High' }
					]}
					disabled={isGeneratingMessage}
					tooltip="Adjust the reasoning effort level for the model"
					on:change={handlers.reasoningEffort}
				/>
			{/if}

			{#each $visibleParameters as param (param.key)}
				{@const constraints = getThinkingModeConstraints(
					param,
					$settingsStore.provider,
					$settingsStore.enableThinking
				)}
				{@const displayValue = getParamValue(param)}
				<div class="parameter-wrapper" class:omitted={isParamOmitted(param)}>
					<Slider
						label={param.label + (isParamOmitted(param) ? ' (Not sent in request)' : '')}
						value={displayValue}
						min={constraints.min}
						max={constraints.max}
						step={param.step}
						disabled={isGeneratingMessage || constraints.disabled}
						tooltip={param.description}
						on:input={(e) => handlers.param(param, e.detail)}
						on:change={(e) => handlers.param(param, e.detail)}
					/>
				</div>
			{/each}

			{#if $settingsStore.provider === ProviderEnum.anthropic}
				<StyledTextInput
					label="Stop Sequences"
					value={$settingsStore.stop_sequences?.join(', ') || ''}
					placeholder="Enter stop sequences (comma-separated)"
					on:input={handlers.stopSequences}
					disabled={isGeneratingMessage}
				/>
			{/if}
		</Dropdown>

		<Dropdown
			title="Tools"
			isOpen={dropdownStates.tools}
			on:click={() => handlers.toggleDropdown('tools')}
			disabled={isGeneratingMessage}
		>
			<div class="tools-content">
				{#if Object.keys($settingsStore.availableTools).length === 0}
					<p class="no-tools-text">No tools available</p>
				{:else}
					{#each Object.entries($settingsStore.availableTools) as [name, description]}
						<ToolItem
							tool={{ name, description }}
							checked={$settingsStore.selectedTools.includes(name)}
							disabled={isGeneratingMessage}
							onChange={handlers.toggleTool}
							onDelete={async (toolName) => {
								if ($settingsStore.selectedTools.includes(toolName)) {
									handlers.toggleTool(toolName);
								}
								await settingsStore.fetchAvailableTools();
							}}
						/>
					{/each}
				{/if}

				<button
					class="add-tool-item"
					on:click={handlers.openAddTool}
					disabled={isGeneratingMessage}
					type="button"
				>
					<div class="tool-info">
						<span class="tool-name">
							<span class="plus-icon">+</span>
							Add Custom Tool
						</span>
					</div>
				</button>
			</div>
		</Dropdown>

		{#if $showBaseUrl}
			<StyledTextInput
				label="Base URL"
				value={$settingsStore.baseUrl}
				placeholder="Enter base URL"
				on:input={handlers.baseUrl}
				on:blur={handlers.baseUrl}
				disabled={isGeneratingMessage}
			/>
		{/if}

		<Toggle
			label="Streaming"
			checked={$settingsStore.streaming}
			disabled={isGeneratingMessage}
			on:change={() => handlers.toggleFeature('streaming')}
		/>
	</div>
</div>

<AddToolModal
	isOpen={showAddToolModal}
	on:close={handlers.closeAddTool}
	on:success={handlers.toolAdded}
/>

<style>
	@import '../../lib/styles/components/ToolSettingsMenu/tool-settings-menu.css';
</style>
