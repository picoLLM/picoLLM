import DOMPurify from 'dompurify';
import CodeHighlighter from '$components/ChatWindow/Messages/CodeHighlighter/CodeHighlighter.svelte';
import ThinkBlock from '$components/ChatWindow/Messages/Thinking/Thinking.svelte';
import { CodeBlock, ThinkBlockData, TableData } from '$lib/types/markdown';
import { PATTERNS, PURIFY_CONFIG } from '$lib/constants/markdown.constants';

// Import processors and utilities
import { ListProcessor } from './lists';
import { InlineProcessor } from './inline';
import { MathProcessor } from './math';
import { SSEThinkingHandler } from './sse';
import { StringBuilder } from './string-builder';
import { TableProcessor } from './tables';
import { UrlSanitizer } from './url-sanitizer';

export class MarkdownService {
	private codeBlocks = new Map<string, CodeBlock>();
	private thinkBlocks = new Map<string, ThinkBlockData>();
	private tables = new Map<string, TableData>();
	private blockIndex = 0;
	private messageId: string;

	// Processors
	private listProcessor = new ListProcessor();
	private inlineProcessor = new InlineProcessor();
	private mathProcessor = new MathProcessor();
	private tableProcessor = new TableProcessor();
	private urlSanitizer = new UrlSanitizer();
	private sseThinkingHandler: SSEThinkingHandler;
	private stringBuilder = new StringBuilder();

	// Cache for processed inline content
	private inlineCache = new Map<string, string>();

	constructor(messageId: string) {
		this.messageId = messageId;
		this.sseThinkingHandler = new SSEThinkingHandler(
			this.thinkBlocks,
			this.processMarkdownText.bind(this)
		);
	}

	public getCodeBlocks(): Map<string, CodeBlock> {
		return this.codeBlocks;
	}

	public getThinkBlocks(): Map<string, ThinkBlockData> {
		return this.thinkBlocks;
	}

	public getTables(): Map<string, TableData> {
		return this.tables;
	}

	private createBlockId(index: number): string {
		return `code-${this.messageId}-${index}`;
	}

	private createThinkId(index: number): string {
		return `think-${this.messageId}-${index}`;
	}

	private createTableId(index: number): string {
		return `table-${this.messageId}-${index}`;
	}

	public normalizeStreamContent(text: string, isStreaming: boolean): string {
		let normalized = text.replace(/\r/g, '').trim();
		if (isStreaming) {
			normalized = normalized.replace(/\[done\]$/i, '');
		}
		return normalized;
	}

	// SSE Thinking delegation
	public async handleSSEThinkingStart(tickFn: () => Promise<void>): Promise<string> {
		const blockId = this.createThinkId(this.blockIndex++);
		return this.sseThinkingHandler.handleStart(blockId, tickFn);
	}

	public async handleSSEThinkingDelta(delta: string, tickFn: () => Promise<void>): Promise<void> {
		return this.sseThinkingHandler.handleDelta(delta, tickFn);
	}

	public async handleSSEThinkingEnd(tickFn: () => Promise<void>): Promise<void> {
		return this.sseThinkingHandler.handleEnd(tickFn);
	}

	public async updateCodeBlock(
		blockId: string,
		rawContent: string,
		language: string,
		tickFn: () => Promise<void>
	) {
		if (!rawContent) return;
		const normalized = this.normalizeStreamContent(rawContent, false);
		let block = this.codeBlocks.get(blockId);

		if (block) {
			const trimmedNorm = normalized.trim();
			const trimmedBlock = block.content.trim();
			if (trimmedNorm !== trimmedBlock) {
				block.content = normalized;
				block.component?.$set({
					code: normalized
				});
			}
		} else {
			block = new CodeBlock(blockId, normalized, language);
			this.codeBlocks.set(blockId, block);
			await tickFn();
			const wrapper = document.getElementById(blockId);
			if (!wrapper) return;

			block.component = new CodeHighlighter({
				target: wrapper,
				props: {
					code: normalized,
					language: language || 'plaintext',
					langtag: true,
					messageId: `${this.messageId}-${blockId}`
				}
			});
		}
	}

	public async updateThinkBlock(
		blockId: string,
		rawContent: string,
		isStreaming: boolean,
		tickFn: () => Promise<void>
	) {
		if (!rawContent) return;
		const normalized = this.normalizeStreamContent(rawContent, isStreaming);
		const processed = this.processMarkdownText(normalized);
		const sanitized = DOMPurify.sanitize(processed, PURIFY_CONFIG);

		let block = this.thinkBlocks.get(blockId);

		if (block) {
			const trimmedSanitized = sanitized.trim();
			const trimmedBlock = block.content.trim();
			if (trimmedBlock !== trimmedSanitized) {
				block.content = sanitized;
				block.component?.$set({ content: sanitized, isStreaming });
			}
		} else {
			block = new ThinkBlockData(blockId, sanitized);
			this.thinkBlocks.set(blockId, block);
			await tickFn();
			const wrapper = document.getElementById(blockId);
			if (!wrapper) return;

			block.component = new ThinkBlock({
				target: wrapper,
				props: {
					content: sanitized,
					isStreaming
				}
			});
		}
	}

	private normalizeTextBlocks(text: string): string {
		if (!text) return text;

		const n = PATTERNS.norm;
		return text
			.replace(n.multi, '\n\n')
			.replace(n.header, '$1\n\n')
			.replace(n.list, '$1\n')
			.replace(n.orderedList, '$1\n')
			.replace(n.preList, '$1\n\n$2')
			.replace(n.preCode, '$1\n\n```')
			.replace(n.codeBlock, '```$1\n$2\n```')
			.replace(n.extraCode, '```\n');
	}



	public processMarkdownText(text: string): string {
	if (!text.trim()) return '';

	text = this.normalizeTextBlocks(text);
	
	// Process math before other elements
	text = this.mathProcessor.processMath(text);
			
	// Process lists first
	text = this.listProcessor.processLists(text, {
		onCodeBlock: (id, content, language) => {
			this.codeBlocks.set(id, new CodeBlock(id, content, language));
		},
		onTable: (id, content) => {
			this.parseTableData(id, content);
		},
		createBlockId: this.createBlockId.bind(this),
		createTableId: this.createTableId.bind(this),
		blockIndex: () => this.blockIndex++,
		processInline: (text) => this.processInlineMarkdown(text)
	});

	// Process headers and blockquotes
	text = this.inlineProcessor.processBlockLevel(text, t => this.processInlineMarkdown(t));

	// Update tables
	for (const [tableId, table] of this.tables) {
		const wrapper = document.getElementById(tableId);
		if (wrapper && table.isComplete) {
			wrapper.innerHTML = this.renderTable(table);
		}
	}

	// Process into paragraphs
	const lines = text.split('\n');
	const result: string[] = [];
	let paragraph: string[] = [];
	
	for (const line of lines) {
		if (!line.trim()) {
			// Empty line - end paragraph
			if (paragraph.length > 0) {
				const content = this.processInlineMarkdown(paragraph.join(' '));
				result.push(`<p class="markdown-paragraph">${content}</p>`);
				paragraph = [];
			}
		} else if (
			line.trim().startsWith('<') && (
				line.includes('class="markdown-') ||
				line.includes('code-block-wrapper') ||
				line.includes('table-wrapper')
			)
		) {
			// Block element - flush paragraph and add block
			if (paragraph.length > 0) {
				const content = this.processInlineMarkdown(paragraph.join(' '));
				result.push(`<p class="markdown-paragraph">${content}</p>`);
				paragraph = [];
			}
			result.push(line);
		} else {
			// Regular text - add to paragraph
			paragraph.push(line);
		}
	}
	
	// Flush remaining paragraph
	if (paragraph.length > 0) {
		const content = this.processInlineMarkdown(paragraph.join(' '));
		result.push(`<p class="markdown-paragraph">${content}</p>`);
	}

	return `<div class="markdown-content">${result.join('')}</div>`;
}

	private processInlineMarkdown(text: string): string {
		// Check cache first
		const cached = this.inlineCache.get(text);
		if (cached) return cached;

		const processed = this.inlineProcessor.processInlineMarkdown(
			text,
			t => this.mathProcessor.processMath(t),
			url => this.urlSanitizer.sanitizeUrl(url)
		);

		// Cache the result
		this.inlineCache.set(text, processed);
		return processed;
	}

	private parseTableData(tableId: string, content: string): void {
		const tableData = this.tableProcessor.parseTableData(content);
		if (tableData) {
			tableData.id = tableId;
			this.tables.set(tableId, tableData);
		}
	}

	private renderTable(table: TableData): string {
		return this.tableProcessor.renderTable(
			table,
			text => this.processInlineMarkdown(text)
		);
	}

	public processMarkdown(text: string, isStreaming: boolean, tickFn: () => Promise<void>): string {
		if (!text) return '';

		text = this.normalizeTextBlocks(text);

		const result: string[] = [];
		let inCodeBlock = false;
		let currentBlockId: string | null = null;
		let currentLanguage = '';
		const currentBlockContent: string[] = [];
		let inThinkBlock = false;
		let currentThinkId: string | null = null;
		const currentThinkContent: string[] = [];
		let inTable = false;
		let currentTableId: string | null = null;
		const currentTableContent: string[] = [];
		const buffer: string[] = [];
		const lines = text.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const isLastLine = i === lines.length - 1;

			// Horizontal Rule
			if (PATTERNS.hr.test(line)) {
				if (buffer.length) {
					result.push(this.processMarkdownText(buffer.join('\n')));
					buffer.length = 0;
				}
				result.push(`<div class="markdown-hr-container"><hr class="markdown-hr" /></div>`);
				continue;
			}

			// Code Blocks
			if (line.trim().startsWith('```')) {
				if (!inCodeBlock) {
					if (buffer.length) {
						result.push(this.processMarkdownText(buffer.join('\n')));
						buffer.length = 0;
					}
					currentLanguage = line.slice(3).trim().split(/\s+/)[0] || 'plaintext';
					currentBlockId = this.createBlockId(this.blockIndex++);
					result.push(`<div class="code-block-wrapper" id="${currentBlockId}"></div>`);
					inCodeBlock = true;
					currentBlockContent.length = 0;
				} else {
					const content = currentBlockContent.join('\n').replace(/\n+$/, '');
					this.updateCodeBlock(currentBlockId!, content, currentLanguage, tickFn);
					inCodeBlock = false;
					currentBlockId = null;
				}
				continue;
			}

			// Tables
			if (PATTERNS.table.row.test(line) && !inCodeBlock && !inThinkBlock) {
				if (!inTable) {
					if (buffer.length) {
						result.push(this.processMarkdownText(buffer.join('\n')));
						buffer.length = 0;
					}
					inTable = true;
					currentTableId = this.createTableId(this.blockIndex++);
					result.push(`<div class="markdown-table-wrapper" id="${currentTableId}"></div>`);
					currentTableContent.length = 0;
				}
				currentTableContent.push(line);

				if (isStreaming) {
					const hasCompleteRow = this.tableProcessor.hasCompleteTableRow(currentTableContent);
					if (hasCompleteRow) {
						this.updateTable(currentTableId!, currentTableContent.join('\n'), isStreaming, tickFn);
					}
				} else {
					this.updateTable(currentTableId!, currentTableContent.join('\n'), isStreaming, tickFn);
				}
				continue;
			} else if (inTable && (!PATTERNS.table.row.test(line) || line.trim() === '')) {
				this.updateTable(currentTableId!, currentTableContent.join('\n'), false, tickFn);
				inTable = false;
				currentTableId = null;
				currentTableContent.length = 0;

				if (line.trim() !== '') {
					buffer.push(line);
				}
				continue;
			}

			// Think Blocks (only for inline <think> tags, not SSE)
			if (PATTERNS.thinkStart.test(line) || (inThinkBlock && PATTERNS.thinkEnd.test(line))) {
				const thinkStart = line.indexOf('<think');
				const thinkEnd = line.indexOf('</think');

				if (thinkStart !== -1 && !inThinkBlock) {
					if (buffer.length) {
						result.push(this.processMarkdownText(buffer.join('\n')));
						buffer.length = 0;
					}
					inThinkBlock = true;
					currentThinkId = this.createThinkId(this.blockIndex++);
					result.push(`<div class="thinking-block-wrapper" id="${currentThinkId}"></div>`);
					const cutPos = line.indexOf('>') + 1;
					currentThinkContent.push(line.slice(cutPos));
				} else if (thinkEnd !== -1 && inThinkBlock) {
					currentThinkContent.push(line.slice(0, thinkEnd));
					this.updateThinkBlock(
						currentThinkId!,
						currentThinkContent.join('\n'),
						isStreaming,
						tickFn
					);
					inThinkBlock = false;
					currentThinkId = null;
					currentThinkContent.length = 0;
				} else if (inThinkBlock) {
					currentThinkContent.push(line);
				}
				continue;
			}

			// Within blocks
			if (inCodeBlock) {
				currentBlockContent.push(line);
			} else if (inTable) {
				currentTableContent.push(line);
			} else if (inThinkBlock) {
				currentThinkContent.push(line);
			} else if (line.trim() || !isStreaming || !isLastLine) {
				buffer.push(line);
			}
		}

		// Process remaining content
		if (buffer.length) {
			result.push(this.processMarkdownText(buffer.join('\n').trimEnd()));
		}

		if (inCodeBlock && currentBlockId) {
			this.updateCodeBlock(
				currentBlockId,
				currentBlockContent.join('\n').trimEnd(),
				currentLanguage,
				tickFn
			);
		}

		if (inThinkBlock && currentThinkId) {
			this.updateThinkBlock(
				currentThinkId,
				currentThinkContent.join('\n').trimEnd(),
				isStreaming,
				tickFn
			);
		}

		if (inTable && currentTableId) {
			this.updateTable(
				currentTableId,
				currentTableContent.join('\n').trimEnd(),
				isStreaming,
				tickFn
			);
		}

		return result.join('').replace(PATTERNS.norm.whitespace, '><').trim();
	}

	private async updateTable(
		tableId: string,
		content: string,
		isStreaming: boolean,
		tickFn: () => Promise<void>
	) {
		if (!content) return;

		const table = this.tables.get(tableId) || new TableData(tableId);
		this.parseTableData(tableId, content);

		const updatedTable = this.tables.get(tableId);
		if (updatedTable && (updatedTable.rows.length > 0 || !isStreaming)) {
			await tickFn();
			const wrapper = document.getElementById(tableId);
			if (wrapper) {
				wrapper.innerHTML = this.renderTable(updatedTable);
				wrapper.setAttribute('data-streaming', isStreaming ? 'true' : 'false');
			}
		}
	}

	public sanitizeContent(content: string): string {
		return DOMPurify.sanitize(content, PURIFY_CONFIG).trim();
	}

	public destroyComponents(): void {
		for (const block of this.codeBlocks.values()) {
			block.component?.$destroy();
		}
		for (const block of this.thinkBlocks.values()) {
			block.component?.$destroy();
		}
		this.tables.clear();
		this.inlineCache.clear();
		this.stringBuilder.clear();
	}
}