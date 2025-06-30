import type { SettingsState } from '$lib/types/settings';

export type NumericSettingKey = keyof Pick<
	SettingsState,
	| 'temperature'
	| 'top_p'
	| 'max_tokens'
	| 'presence_penalty'
	| 'frequency_penalty'
	| 'top_k'
	| 'n'
	| 'alpha'
	| 'thinking_budget_tokens'
>;

export const numericParamKeys: readonly NumericSettingKey[] = [
	'temperature',
	'top_p',
	'max_tokens',
	'presence_penalty',
	'frequency_penalty',
	'top_k',
	'n',
	'alpha',
	'thinking_budget_tokens'
] as const;

export interface ParameterConfig {
	key: NumericSettingKey;
	label: string;
	min: number;
	max: number;
	step: number;
	defaultValue: number;
	description: string;
	category: 'common' | 'openai' | 'anthropic' | 'rag';
	optional?: boolean;
	omitValue?: number;
}

const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

export const parameterConfigs: Record<NumericSettingKey, ParameterConfig> = {
	temperature: {
		key: 'temperature',
		label: 'Temperature',
		min: 0,
		max: 1,
		step: 0.01,
		defaultValue: 0.7,
		description: 'Sampling temperature between 0 and 1',
		category: 'common'
	},
	max_tokens: {
		key: 'max_tokens',
		label: 'Max Tokens',
		min: 1,
		max: 64000,
		step: 1,
		defaultValue: 2048,
		description: 'Maximum number of tokens to generate',
		category: 'common'
	},
	top_p: {
		key: 'top_p',
		label: 'Top P',
		min: 0.01,
		max: 1,
		step: 0.01,
		defaultValue: 1,
		description: 'Nucleus sampling parameter',
		category: 'common',
		optional: true,
		omitValue: 1
	},
	presence_penalty: {
		key: 'presence_penalty',
		label: 'Presence Penalty',
		min: -2,
		max: 2,
		step: 0.1,
		defaultValue: 0,
		description: 'Presence penalty for token selection',
		category: 'openai'
	},
	frequency_penalty: {
		key: 'frequency_penalty',
		label: 'Frequency Penalty',
		min: -2,
		max: 2,
		step: 0.1,
		defaultValue: 0,
		description: 'Frequency penalty for token selection',
		category: 'openai'
	},
	n: {
		key: 'n',
		label: 'Number of Completions',
		min: 1,
		max: 5,
		step: 1,
		defaultValue: 1,
		description: 'Number of completions to generate',
		category: 'openai'
	},
	top_k: {
		key: 'top_k',
		label: 'Top K',
		min: 0,
		max: 100,
		step: 1,
		defaultValue: 0,
		description: 'Only sample from top K options for each token',
		category: 'anthropic',
		optional: true,
		omitValue: 0
	},
	alpha: {
		key: 'alpha',
		label: 'Alpha',
		min: 0,
		max: 1,
		step: 0.1,
		defaultValue: 0.5,
		description: 'Balancing factor for hybrid search',
		category: 'rag'
	},
	thinking_budget_tokens: {
		key: 'thinking_budget_tokens',
		label: 'Thinking Budget Tokens',
		min: 1024,
		max: 50000,
		step: 1,
		defaultValue: 1024,
		description: 'Maximum tokens allocated for thinking process',
		category: 'anthropic'
	}
};

export const paramUtils = {
	validate(key: NumericSettingKey, value: number): number {
		const cfg = parameterConfigs[key];
		const v = cfg.step >= 1 ? Math.round(value) : value;
		return Math.max(cfg.min, Math.min(cfg.max, v));
	},

	getForRequest(key: NumericSettingKey, value: number | undefined): number | undefined {
		const cfg = parameterConfigs[key];
		
		// Use provided value or default
		const actualValue = value ?? cfg.defaultValue;
		
		// Check if we should omit this parameter
		if (cfg.optional && cfg.omitValue !== undefined && actualValue === cfg.omitValue) {
			return undefined;
		}
		
		// Validate and return
		return this.validate(key, actualValue);
	},

	getByProvider(provider: string): ParameterConfig[] {
		const isAnthropicProvider = provider === 'anthropic';
		return Object.values(parameterConfigs).filter(
			(p) =>
				p.category === 'common' || p.category === (isAnthropicProvider ? 'anthropic' : 'openai')
		);
	}
};

export const validateParameterValue = paramUtils.validate;
export const getParameterValueForRequest = paramUtils.getForRequest;
export const getProviderParameters = paramUtils.getByProvider;

export function isParameterActive(key: NumericSettingKey, value: number | undefined): boolean {
	return value !== undefined;
}

export function getDisplayValue(key: NumericSettingKey, value: number | undefined): number {
	return value ?? parameterConfigs[key].defaultValue;
}