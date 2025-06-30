import DOMPurify from 'dompurify';
import ThinkBlock from '$components/ChatWindow/Messages/Thinking/Thinking.svelte';
import { ThinkBlockData } from '$lib/types/markdown';
import { PURIFY_CONFIG } from '$lib/constants/markdown.constants';

export class SSEThinkingHandler {
	private sseThinkingActive = false;
	private sseThinkingId: string | null = null;
	private thinkBlocks: Map<string, ThinkBlockData>;
	private processMarkdownText: (text: string) => string;

	constructor(
		thinkBlocks: Map<string, ThinkBlockData>,
		processMarkdownText: (text: string) => string
	) {
		this.thinkBlocks = thinkBlocks;
		this.processMarkdownText = processMarkdownText;
	}

	async handleStart(blockId: string, tickFn: () => Promise<void>): Promise<string> {
		if (this.sseThinkingActive) return ''; // Already active

		this.sseThinkingActive = true;
		this.sseThinkingId = blockId;

		// Create wrapper element
		const wrapperHtml = `<div class="thinking-block-wrapper" id="${blockId}"></div>`;

		// Initialize empty thinking block
		const block = new ThinkBlockData(blockId, '');
		this.thinkBlocks.set(blockId, block);

		await tickFn();

		// Mount component
		const wrapper = document.getElementById(blockId);
		if (wrapper) {
			block.component = new ThinkBlock({
				target: wrapper,
				props: {
					content: '',
					isStreaming: true
				}
			});
		}

		return wrapperHtml;
	}

	async handleDelta(delta: string, tickFn: () => Promise<void>): Promise<void> {
		if (!this.sseThinkingActive || !this.sseThinkingId) return;

		const block = this.thinkBlocks.get(this.sseThinkingId);
		if (!block) return;

		// Append delta to content
		const currentContent = block.content;
		const newContent = currentContent + delta;

		// Process markdown in the new content
		const processed = this.processMarkdownText(newContent);
		const sanitized = DOMPurify.sanitize(processed, PURIFY_CONFIG);

		block.content = sanitized;
		block.component?.$set({
			content: sanitized,
			isStreaming: true
		});
	}

	async handleEnd(tickFn: () => Promise<void>): Promise<void> {
		if (!this.sseThinkingActive || !this.sseThinkingId) return;

		const block = this.thinkBlocks.get(this.sseThinkingId);
		if (block?.component) {
			block.component.$set({ isStreaming: false });
		}

		this.sseThinkingActive = false;
		this.sseThinkingId = null;
	}

	isActive(): boolean {
		return this.sseThinkingActive;
	}
}