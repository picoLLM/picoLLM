// settings.ts - Fixed version with proper default handling
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { ProviderEnum } from '$lib/types/global';
import type { QdrantFilter } from '$lib/types/qdrant';
import { fetchAvailableTools } from '$lib/api/tools';
import {
	numericParamKeys,
	paramUtils,
	parameterConfigs,
	type NumericSettingKey
} from '$lib/constants/params.constants';
import type { APIMessages, ChatCompletionRequest } from '$lib/types/chat';
import { providerBaseUrls } from '$lib/services/providers/provider.service';
import type { SettingsState } from '$lib/types/settings';
import { createDefaultSettings } from '$lib/types/settings';

const SETTINGS_KEY = 'app_settings';

function createInitialState(): SettingsState {
	const base = createDefaultSettings();

	Object.entries(parameterConfigs).forEach(([key, config]) => {
		if (
			config.optional &&
			config.omitValue !== undefined &&
			config.defaultValue === config.omitValue
		) {
			(base as any)[key] = undefined;
		}
	});

	return base;
}

function createSettingsStore() {
	const initialState = createInitialState();
	const { subscribe, set, update } = writable<SettingsState>(initialState);

	// Storage operations
	const storage = {
		save: () => {
			if (browser) {
				try {
					localStorage.setItem(SETTINGS_KEY, JSON.stringify(get(settingsStore)));
				} catch (e) {
					console.error('Storage save failed:', e);
				}
			}
		},

		load: () => {
			if (!browser) return;

			try {
				const saved = localStorage.getItem(SETTINGS_KEY);
				if (!saved) return;

				const parsed = JSON.parse(saved) as Partial<SettingsState>;
				const freshInitialState = createInitialState();

				// Validate numeric parameters
				numericParamKeys.forEach((key) => {
					const val = parsed[key];
					if (val !== undefined) {
						parsed[key] = paramUtils.validate(key, val);
					}
				});

				// Merge with fresh initial state, preserving undefined values
				const merged = { ...freshInitialState };
				Object.entries(parsed).forEach(([key, value]) => {
					if (value !== undefined || key in parsed) {
						(merged as any)[key] = value;
					}
				});

				set(merged);
			} catch (e) {
				console.error('Storage load failed:', e);
			}
		}
	};

	// Core update function
	const updateStore = (updater: Partial<SettingsState> | ((s: SettingsState) => SettingsState)) => {
		update((s) => {
			const newState = typeof updater === 'function' ? updater(s) : { ...s, ...updater };
			return newState;
		});
		storage.save();
	};

	// Numeric parameter handling
	const setParam = (key: NumericSettingKey, value: number | undefined) => {
		const config = parameterConfigs[key];

		// If setting to omitValue for optional params, store as undefined
		if (config.optional && config.omitValue !== undefined && value === config.omitValue) {
			updateStore({ [key]: undefined });
			return;
		}

		if (value === undefined) {
			updateStore({ [key]: undefined });
			return;
		}

		const validated = paramUtils.validate(key, value);
		if (validated !== undefined) {
			updateStore({ [key]: validated });
		}
	};

	// Feature toggles
	const toggles = {
		streaming: () => updateStore((s) => ({ ...s, streaming: !s.streaming, stream: !s.streaming })),
		thinking: () => updateStore((s) => ({ ...s, enableThinking: !s.enableThinking })),
		rag: () =>
			updateStore((s) => ({
				...s,
				enableRAG: !s.enableRAG,
				...(!s.enableRAG
					? {}
					: {
							qdrantFilter: null,
							selectedCollection: '',
							rerank: false,
							automateFilters: false
						})
			})),
		rerank: () => updateStore((s) => ({ ...s, rerank: !s.rerank })),
		automateFilters: () =>
			updateStore((s) => ({
				...s,
				automateFilters: !s.automateFilters,
				qdrantFilter: !s.automateFilters
					? s.qdrantFilter || { must: [], should: [], must_not: [] }
					: s.qdrantFilter
			})),
		agent: () =>
			updateStore((s) => ({
				...s,
				enableAgent: !s.enableAgent,
				agentWebSocket: !s.enableAgent
			})),
		tool: (name: string) =>
			updateStore((s) => ({
				...s,
				selectedTools: s.selectedTools.includes(name)
					? s.selectedTools.filter((t) => t !== name)
					: [...s.selectedTools, name]
			}))
	};

	const prepareChatRequest = (messages: APIMessages[]): ChatCompletionRequest => {
		const s = get(settingsStore);
		const request: ChatCompletionRequest = {
			messages,
			model: s.model,
			provider: s.provider,
			api_key: s.apiKey || '',
			base_url: s.baseUrl,
			stream: s.streaming
		};

		if (s.selectedTools?.length > 0) {
			request.tools = s.selectedTools;
		}

		if (s.provider === 'anthropic' && s.enableThinking === true) {
			(request as any).thinking = {
				type: 'enabled',
				budget_tokens: s.thinking_budget_tokens || 10000
			};
		}

		// Build reasoning object for OpenAI o-models
		if (
			s.provider === 'openai' &&
			(s.reasoning_effort !== undefined || s.reasoning_summary !== undefined)
		) {
			const isO = s.model && /^o\d+(-.*)?$/i.test(s.model);
			if (isO) {
				const reasoning: any = {};
				if (s.reasoning_effort !== undefined) {
					reasoning.effort = s.reasoning_effort;
				}
				if (s.reasoning_summary !== undefined) {
					reasoning.summary = s.reasoning_summary;
				}
				if (Object.keys(reasoning).length > 0) {
					(request as any).reasoning = reasoning;
				}
			}
		}

		numericParamKeys.forEach((key) => {
			const value = paramUtils.getForRequest(key, s[key]);
			if (value !== undefined) {
				(request as any)[key] = value;
			}
		});

		return request;
	};

	if (browser && localStorage.getItem(SETTINGS_KEY)) {
		storage.load();
	}

	return {
		subscribe,
		update: updateStore,
		set: (s: SettingsState) => {
			set(s);
			storage.save();
		},
		getState: () => get(settingsStore),
		setParam,
		setModel: (model: string) => updateStore({ model }),
		setProvider: (provider: ProviderEnum) => {
			const currentState = get(settingsStore);
			const updates: Partial<SettingsState> = { provider };

			if (
				(provider === ProviderEnum.ollama || provider === ProviderEnum.vllm) &&
				!currentState.baseUrl
			) {
				updates.baseUrl = providerBaseUrls[provider] || '';
			}

			if (
				(provider === ProviderEnum.anthropic || provider === ProviderEnum.openai) &&
				currentState.baseUrl
			) {
				updates.baseUrl = '';
			}

			updateStore(updates);
		},
		setBaseUrl: (baseUrl: string) => updateStore({ baseUrl }),
		setSystemMessage: (systemMessage: string) => updateStore({ systemMessage }),
		setStopSequences: (stop_sequences: string[] | null) => updateStore({ stop_sequences }),
		setSelectedCollection: (selectedCollection: string) =>
			updateStore({ selectedCollection, qdrantFilter: null }),
		setQdrantFilter: (qdrantFilter: QdrantFilter | null) => updateStore({ qdrantFilter }),
		setthinking_budget_tokens: (tokens: number) => setParam('thinking_budget_tokens', tokens),
		setReasoningEffort: (effort: 'low' | 'medium' | 'high' | undefined) => {
			updateStore({ reasoning_effort: effort });
		},
		setReasoningSummary: (summary: 'auto' | 'concise' | 'detailed' | undefined) => {
			updateStore({ reasoning_summary: summary });
		},
		toggles,
		toggleStreaming: toggles.streaming,
		toggleThinking: toggles.thinking,
		toggleRAG: toggles.rag,
		toggleRerank: toggles.rerank,
		toggleAutomateFilters: toggles.automateFilters,
		toggleAgent: toggles.agent,
		toggleTool: toggles.tool,
		updateParameter: (key: keyof SettingsState, value: any) => {
			if (numericParamKeys.includes(key as NumericSettingKey)) {
				setParam(key as NumericSettingKey, value);
			} else {
				updateStore({ [key]: value });
			}
		},
		updateParameters: (updates: Partial<SettingsState>) => updateStore(updates),
		validateAndUpdateParam: (key: NumericSettingKey, value: number) => setParam(key, value),
		prepareChatRequest,
		fetchAvailableTools: async () => {
			try {
				const tools = await fetchAvailableTools();
				updateStore((s) => ({
					...s,
					availableTools: tools,
					selectedTools: s.selectedTools.filter((t) => tools[t])
				}));
			} catch (error) {
				console.error('Error fetching tools:', error);
				updateStore({ availableTools: {} });
			}
		},
		save: storage.save,
		load: storage.load,
		saveToLocalStorage: storage.save,
		loadFromLocalStorage: storage.load,
		reset: () => {
			const freshInitialState = createInitialState();
			set(freshInitialState);
			storage.save();
		}
	};
}

export const settingsStore = createSettingsStore();

export const chatCompletionRequest = derived(settingsStore, ($settings) =>
	settingsStore.prepareChatRequest([])
);
