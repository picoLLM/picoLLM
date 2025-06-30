import { ProviderEnum } from '$lib/types/global';
import Code from '$components/Toolbox/Icons/Code.svelte';
import { 
  FileText, Brain, Eye, Wrench, Edit, MessageSquare, Zap, 
  Monitor, Globe, Rocket, Puzzle, Check, Sparkles, Shield, 
  Image, Lightbulb 
} from 'lucide-svelte';

export const Icons = { Sparkles, Zap, Shield, Brain, Code, Image, MessageSquare, Lightbulb, Wrench };

export const getSuggestions = () => [
  { icon: Brain, text: 'Explain how neural networks learn', color: '#8B5CF6' },
  { icon: Code, text: 'Debug this JavaScript function', color: '#10B981' },
  { icon: MessageSquare, text: 'Draft a project proposal outline', color: '#3B82F6' },
  { icon: Lightbulb, text: 'Brainstorm app ideas', color: '#EC4899' },
  { icon: Image, text: 'Tell me about this image', color: '#F59E0B' },
  { icon: Wrench, text: 'Research this topic and write a report', color: '#06B6D4' }
];

const isAdvancedReasoningModel = (model: string) => 
  /qwq|sonnet-3\.7-|llama4|qwen3/i.test(model);

export const isProviderType = (provider: any, type: string): boolean => {
  const t = type.toLowerCase();
  return typeof provider === 'string' 
    ? provider.toLowerCase().includes(t)
    : provider === ProviderEnum[t as keyof typeof ProviderEnum];
};

export const getProviderLabel = (provider: any): string => {
  const labels: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    ollama: 'Ollama',
    vllm: 'vLLM'
  };
  
  if (typeof provider === 'string') {
    return labels[provider.toLowerCase()] || provider;
  }
  
  return Object.entries(ProviderEnum)
    .find(([_, v]) => v === provider)?.[0]
    .replace(/^\w/, c => c.toUpperCase()) || 'Unknown Provider';
};

const patterns = {
  toolCalling: /qwen3|llama4|llama3\.[123]|mistral-small3\.1|mistral|qwen2\.5|qwen2|mistral-nemo|qwq|mixtral|smollm2|mistral-small|command-r|hermes3|mistral-large|phi4-mini|granite3/i,
  vision: /vision|llama4|mistral-small3\.1|gpt-4o/i,
  longContext: /claude-3|gpt-4|llama[34]|mistral|qwen[23]|nemo|command-r|granite3\.2|large/i,
  advancedReasoning: /opus|sonnet|gpt-4|mistral-(large|small)|mixtral|command-r-plus|granite3\.2|(70b|405b)|hermes3.*(70b|405b)/i,
  enhancedReasoning: /claude-3\.[57].*sonnet|gpt-4o|llama3\.1.*405b|llama3\.3.*70b|qwen3.*(235b|[23][0-9]b)/i,
  fastResponse: /haiku|turbo/i,
  codeGeneration: /claude-3|gpt-|code|coder|starcoder|phi/i,
  multilingual: /phi4|qwen/i,
  mixtureOfExperts: /mixtral|moe|\d+x\d+b/i
};

export function determineModelCapabilities(model: string, provider: any): string[] {
  const caps = new Set<string>();
  const m = model.toLowerCase();
  
  // Provider defaults
  if (isProviderType(provider, 'anthropic')) caps.add("Long Context");
  else if (isProviderType(provider, 'openai')) caps.add("Code Generation");
  else if (isProviderType(provider, 'ollama') || isProviderType(provider, 'vllm')) caps.add("Local Execution");
  
  // Pattern checks
  Object.entries(patterns).forEach(([cap, pattern]) => {
    if (pattern.test(m)) {
      const capName = cap.replace(/([A-Z])/g, ' $1').trim();
      caps.add(capName.charAt(0).toUpperCase() + capName.slice(1));
    }
  });
  
  // Special ollama reasoning check
  if (isProviderType(provider, 'ollama') && isAdvancedReasoningModel(m)) {
    caps.add("Advanced Reasoning").add("Enhanced Reasoning");
  }
  
  // Model attributes
  if (m.includes("instruct")) caps.add("Instruction Tuned");
  if (m.includes("chat")) caps.add("Chat Optimized");
  
  // Size check
  const sizeMatch = m.match(/(\d+)b\b/i);
  if (sizeMatch && parseInt(sizeMatch[1]) >= 30) caps.add("Large Model");
  
  return [...caps].length ? [...caps] : ["Text Generation"];
}

const capabilityIcons: Record<string, any> = {
  "long context": FileText,
  "code generation": Code,
  "reasoning": Brain,
  "advanced reasoning": Brain,
  "enhanced reasoning": Brain,
  "vision": Eye,
  "tools": Wrench,
  "instruction tuned": Edit,
  "chat optimized": MessageSquare,
  "fast response": Zap,
  "local execution": Monitor,
  "multilingual": Globe,
  "large model": Rocket,
  "mixture of experts": Puzzle
};

export const getCapabilityIcon = (capability: string) => 
  capabilityIcons[capability.toLowerCase()] || Check;