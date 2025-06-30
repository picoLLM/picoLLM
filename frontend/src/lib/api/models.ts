import { ProviderEnum } from '$lib/types/global';
import { BACKEND_URL } from '$lib/constants/global.constants';

export async function fetchModels(provider: ProviderEnum): Promise<any> {
    try {
        const response = await fetch(`${BACKEND_URL}/v1/models/${provider}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${provider} models:`, error);
        return null;
    }
}