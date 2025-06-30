import { settingsStore } from '$lib/stores/settings';
import { providerService, providerBaseUrls } from '$lib/services/providers/provider.service';
import { pullOllamaModel, deleteOllamaModel } from '$lib/api/ollama';
import { ProviderEnum } from '$lib/types/global';
import { modelSelectorStore } from '$lib/stores/model-selector';
import { ollamaProgress } from '$lib/stores/ollama-progress';
import type { ModelType, FormattedModelInfo } from '$lib/types/models';
import { formatNumber, formatSize } from '$lib/utils/format';

export const getModelIdentifier = (model: ModelType): string => 
	typeof model === 'string' ? model : (model as any).name || (model as any).id || 'Unknown';

export function formatModelDisplay(model: ModelType): FormattedModelInfo {
	if (typeof model === 'string') return { name: model };

	const m = model as any;
	const base: FormattedModelInfo = { 
		name: m.display_name || getModelIdentifier(model),
		...(m.owned_by && { owner: m.owned_by }),
		...(m.size && { size: formatSize(m.size) }),
		...(m.max_model_len && { modelLen: formatNumber(m.max_model_len) })
	};

	// Date handling
	const dateVal = m.created || (m.created_at && new Date(m.created_at).getTime() / 1000);
	if (dateVal) {
		base.created = new Date(dateVal * 1000).toLocaleDateString('en-US', {
			month: '2-digit', day: '2-digit', year: 'numeric'
		});
	}

	// Ollama details
	if (m.details?.parameter_size) {
		const match = m.details.parameter_size.match(/(\d+(?:\.\d+)?)\s*([BM])/i);
		if (match) base.params = `${match[1]}${match[2].toUpperCase()}`;
		if (m.details.quantization_level) base.quantization = m.details.quantization_level;
		base.name = m.name.split(':')[0];
	}

	// Extract params from name
	if (!base.params) {
		const paramMatch = base.name.match(/(\d+)([mb])/i);
		if (paramMatch) base.params = `${paramMatch[1]}${paramMatch[2].toUpperCase()}`;
	}

	return base;
}

async function fetchModelsForProvider(provider: ProviderEnum): Promise<ModelType[]> {
	try {
		return await providerService.fetchProviderModels(provider);
	} catch (error) {
		console.error('Error fetching models:', error);
		return [];
	}
}

export async function initializeModelSelector(): Promise<void> {
	const { provider, model } = settingsStore.getState();
	console.log('Initializing model selector with model:', model);
	const models = await fetchModelsForProvider(provider);
	modelSelectorStore.setCurrentModels(models);
	console.log(`Loaded ${models.length} models for ${provider}`);
}

export async function pullModel(modelName: string): Promise<void> {
	modelSelectorStore.toggleModelDropdown(false);
	ollamaProgress.startDownload();
	ollamaProgress.updateProgress({ status: 'pulling manifest', completed: 0, total: 0 });

	try {
		const updatedModels = await pullOllamaModel(modelName);
		if (updatedModels.length > 0) {
			modelSelectorStore.setCurrentModels(updatedModels);
			const downloadedModel = updatedModels.find(m => getModelIdentifier(m) === modelName);
			selectModel(getModelIdentifier(downloadedModel || updatedModels[0]));
		}
		ollamaProgress.updateProgress({ status: 'success', completed: 100, total: 100 });
	} catch (error) {
		console.error('Error pulling Ollama model:', error);
		ollamaProgress.updateProgress({
			status: 'error',
			message: error instanceof Error ? error.message : 'Unknown error'
		});
	}
	setTimeout(() => ollamaProgress.stopDownload(), 3000);
}

export async function changeProvider(provider: ProviderEnum) {
	settingsStore.setProvider(provider);
	const models = await fetchModelsForProvider(provider);
	modelSelectorStore.setCurrentModels(models);
	modelSelectorStore.toggleProviderDropdown(false);
	return { baseUrl: providerBaseUrls[provider], models };
}

export async function refreshModels(provider: ProviderEnum, searchQuery?: string): Promise<ModelType[]> {
	const allModels = await fetchModelsForProvider(provider);
	const models = searchQuery
		? allModels.filter(model => getModelIdentifier(model).toLowerCase().includes(searchQuery.toLowerCase()))
		: allModels;
	modelSelectorStore.setCurrentModels(models);
	return models;
}

export const refreshVllmModels = (searchQuery: string) => refreshModels(ProviderEnum.vllm, searchQuery);

export function selectModel(modelName: string): void {
	console.log('selectModel called with:', modelName);
	settingsStore.setModel(modelName);
	settingsStore.saveToLocalStorage();
}

export function handleModelSelection(modelName: string): void {
	selectModel(modelName);
	modelSelectorStore.toggleModelDropdown(false);
}

export const selectModelKeepOpen = selectModel;

export function handleModelSearch(inputValue: string, provider: ProviderEnum): void {
	settingsStore.setModel(inputValue);
	if (provider === ProviderEnum.vllm) void refreshVllmModels(inputValue);
	modelSelectorStore.toggleModelDropdown(true);
}

export const findMatchingModel = (searchTerm: string, models: ModelType[]) =>
	models.find(model => getModelIdentifier(model).toLowerCase() === searchTerm.toLowerCase());

export const openModelDropdown = () => modelSelectorStore.toggleModelDropdown(true);

export function handleModelEnterKey(
	searchTerm: string,
	highlightIndex: number,
	filteredModels: ModelType[],
	isDownloadable: boolean
): void {
	if (highlightIndex === -1) {
		const matchingModel = findMatchingModel(searchTerm, filteredModels);
		if (matchingModel) handleModelSelection(getModelIdentifier(matchingModel));
		else if (isDownloadable) void pullModel(searchTerm);
	} else if (highlightIndex < filteredModels.length) {
		handleModelSelection(getModelIdentifier(filteredModels[highlightIndex]));
	} else if (isDownloadable) {
		void pullModel(searchTerm);
	}
}

export const isModelDownloadable = (provider: ProviderEnum, searchTerm: string, currentModels: ModelType[]) =>
	provider === ProviderEnum.ollama && !!searchTerm && !findMatchingModel(searchTerm, currentModels);

export async function handleModelDeletion(modelName: string): Promise<ModelType[]> {
	console.log(`Deleting model: ${modelName}`);
	await deleteOllamaModel(modelName);
	return fetchModelsForProvider(ProviderEnum.ollama);
}

export function initializeFromLocalStorage(): string {
	let modelName = '';
	try {
		const rawSettings = localStorage.getItem('app_settings');
		if (rawSettings) {
			const parsed = JSON.parse(rawSettings);
			if (parsed.model) {
				modelName = parsed.model;
				console.log('Setting initial model from localStorage:', parsed.model);
			}
		}
	} catch (e) {
		console.error('Error reading localStorage:', e);
	}
	settingsStore.loadFromLocalStorage();
	const { model } = settingsStore.getState();
	return model || modelName;
}

export const isOpenAIModel = (model: ModelType) => 
	typeof model !== 'string' && !!(model as any).created && !(model as any).created_at;

export const isVllmModel = (model: ModelType) => 
	typeof model !== 'string' && !!(model as any).max_model_len;

export const isOllamaModel = (model: ModelType) => 
	typeof model !== 'string' && !!(model as any).size && !!(model as any).name;

export const handleOllamaModelPull = async (modelName: string) => {
	await pullModel(modelName);
	return fetchModelsForProvider(ProviderEnum.ollama);
};