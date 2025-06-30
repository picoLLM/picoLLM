// lib/services/providers/provider.service.ts
import type { ModelType, ModelLists, OllamaModelDetails, vLLMModel } from '$lib/types/models';
import { ProviderEnum } from '$lib/types/global';
import type { ProviderStrategy, ProviderConfig } from '$lib/types/provider';
import type { ChatCompletionRequest } from '$lib/types/chat';
import { fetchModels } from '$lib/api/models';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { OpenAICompatibleProvider } from './openai-like';

const PROVIDER_CONFIG: Record<ProviderEnum, ProviderConfig> = {
  [ProviderEnum.vllm]: { dateField: 'created' },
  [ProviderEnum.ollama]: { dateField: 'modified_at' },
  [ProviderEnum.anthropic]: { dateField: 'created_at', hasDisplayNames: true },
  [ProviderEnum.openai]: { dateField: 'created' }
};

const DEFAULT_SEARCH_FIELDS = ['name', 'id', 'owned_by', 'display_name'];

export class ProviderService {
  private modelLists: ModelLists = {
    [ProviderEnum.vllm]: [],
    [ProviderEnum.ollama]: [],
    [ProviderEnum.anthropic]: [],
    [ProviderEnum.openai]: []
  };
  
  private displayNames = new Map<string, string>();
  private fetchCache = new Map<ProviderEnum, Promise<ModelType[]>>();
  
  // Factory method integrated into service
  getStrategy(config: ChatCompletionRequest): ProviderStrategy {
    switch (config.provider) {
      case ProviderEnum.anthropic:
        return new AnthropicProvider();
      case ProviderEnum.openai:
        return new OpenAIProvider();
      default:
        return new OpenAICompatibleProvider();
    }
  }
  
  async fetchProviderModels(provider: ProviderEnum): Promise<ModelType[]> {
    const cached = this.fetchCache.get(provider);
    if (cached) return cached;
    
    const promise = this.fetchAndProcess(provider);
    this.fetchCache.set(provider, promise);
    
    try {
      return await promise;
    } finally {
      setTimeout(() => this.fetchCache.delete(provider), 100);
    }
  }
  
  private async fetchAndProcess(provider: ProviderEnum): Promise<ModelType[]> {
    const data = await fetchModels(provider);
    return data ? this.processModels(provider, data) : [];
  }
  
  private processModels(provider: ProviderEnum, data: any): ModelType[] {
    const config = PROVIDER_CONFIG[provider];
    if (!config) return [];
    
    let models = data.data || data.models || (Array.isArray(data) ? data : []);
    
    if (config.dateField) {
      models = [...models].sort((a, b) => {
        const getTime = (v: any) => {
          if (!v) return 0;
          return config.dateField!.includes('_at') ? new Date(v).getTime() : v;
        };
        return getTime(b[config.dateField!]) - getTime(a[config.dateField!]);
      });
    }
    
    if (config.hasDisplayNames) {
      this.displayNames.clear();
      models.forEach((m: any) => {
        if (m.display_name) this.displayNames.set(m.id, m.display_name);
      });
    }
    
    this.modelLists[provider] = models;
    return models;
  }
  
  getModelListForProvider(provider: ProviderEnum): ModelType[] {
    return this.modelLists[provider] || [];
  }
  
  getModelDisplayName(modelId: string): string {
    return this.displayNames.get(modelId) || modelId;
  }
  
  filterModelsBySearchTerm(provider: ProviderEnum, searchTerm?: string | null): ModelType[] {
    const models = this.getModelListForProvider(provider);
    if (!searchTerm) return models;
    
    const config = PROVIDER_CONFIG[provider];
    if (!config) return models;
    
    const search = searchTerm.toLowerCase();
    const searchFields = config.searchFields || DEFAULT_SEARCH_FIELDS;
    
    return models.filter((model: ModelType) => {
      if (typeof model === 'string') {
        return model.toLowerCase().includes(search) || 
               (config.hasDisplayNames && this.getModelDisplayName(model).toLowerCase().includes(search));
      }
      
      const modelObj = model as any;
      return searchFields.some(field => modelObj[field]?.toString().toLowerCase().includes(search)) ||
             (config.hasDisplayNames && modelObj.id && this.getModelDisplayName(modelObj.id).toLowerCase().includes(search));
    });
  }
}

// Export singleton instance
export const providerService = new ProviderService();

export const providerBaseUrls: Record<ProviderEnum, string> = {
  [ProviderEnum.vllm]: 'http://nginx/v1/vllm',
  [ProviderEnum.ollama]: 'http://nginx/v1',
  [ProviderEnum.anthropic]: '',
  [ProviderEnum.openai]: ''
};