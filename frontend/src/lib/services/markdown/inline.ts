import { PATTERNS } from '$lib/constants/markdown.constants';

export class InlineProcessor {
	processInlineMarkdown(
		text: string,
		processMath: (text: string) => string,
		sanitizeUrl: (url: string) => string
	): string {
		// Process math first to avoid conflicts
		text = processMath(text);
		
		// Extract and protect inline code blocks with better matching
		const codeBlocks: string[] = [];
		let codeIndex = 0;
		
		// Match inline code more carefully - require matching backticks
		text = this.extractInlineCode(text, (code) => {
			const placeholder = `\x00CODE${codeIndex}\x00`;
			codeBlocks[codeIndex] = code;
			codeIndex++;
			return placeholder;
		});
		
		// Process emphasis/bold/strikethrough
		text = this.processEmphasis(text);
		
		// Process images
		text = text.replace(PATTERNS.images, (_, alt, src) => {
			const safeSrc = sanitizeUrl(src);
			if (safeSrc && safeSrc !== '#' && /^https?:\/\//i.test(safeSrc)) {
				const cleanAlt = alt.replace(/<[^>]*>/g, '').trim() || '';
				return `<img src="${safeSrc}" alt="${cleanAlt}" class="markdown-image" loading="lazy">`;
			}
			return '';
		});
		
		// Process links
		text = text.replace(PATTERNS.links, (match, linkText, url) => {
			if (!linkText || !linkText.trim()) return '';
			const safeUrl = sanitizeUrl(url);
			const isExternal = /^https?:\/\//i.test(safeUrl);
			return `<a href="${safeUrl}" class="markdown-link"${
				isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
			}>${linkText}</a>`;
		});
		
		// Restore code blocks
		text = text.replace(/\x00CODE(\d+)\x00/g, (match, index) => {
			const code = codeBlocks[parseInt(index)];
			const escaped = code
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
			return `<code class="inline-code">${escaped}</code>`;
		});
		
		// Handle orphaned backticks (escape them)
		text = text.replace(/(?<!\\)`(?!`)/g, '\\`');
		
		return text;
	}
	
	private extractInlineCode(text: string, replacer: (code: string) => string): string {
		let result = '';
		let i = 0;
		
		while (i < text.length) {
			if (text[i] === '`' && (i === 0 || text[i-1] !== '\\')) {
				// Found potential start of inline code
				let j = i + 1;
				let foundEnd = false;
				
				// Look for matching closing backtick
				while (j < text.length) {
					if (text[j] === '`' && text[j-1] !== '\\') {
						// Found matching backtick
						const code = text.substring(i + 1, j);
						// Only treat as code if it's not empty and doesn't contain newlines
						if (code.length > 0 && !code.includes('\n')) {
							result += replacer(code);
							i = j + 1;
							foundEnd = true;
							break;
						}
					}
					j++;
				}
				
				if (!foundEnd) {
					// No matching backtick found, treat as literal
					result += text[i];
					i++;
				}
			} else {
				result += text[i];
				i++;
			}
		}
		
		return result;
	}
	
	private processEmphasis(text: string): string {
		const protectedContent: string[] = [];
		let protectIndex = 0;
		
		// 1. Process strikethrough first
		text = text.replace(/~~([^~]+?)~~/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<del>${content}</del>`);
			return placeholder;
		});
		
		// 2. Process triple markers
		text = text.replace(/\*\*\*([^*]+?)\*\*\*/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<strong><em>${content}</em></strong>`);
			return placeholder;
		});
		
		text = text.replace(/___([^_]+?)___/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<strong><em>${content}</em></strong>`);
			return placeholder;
		});
		
		// 3. Process mixed markers for bold+italic
		text = text.replace(/\*\*_(.+?)_\*\*/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<strong><em>${content}</em></strong>`);
			return placeholder;
		});
		
		text = text.replace(/__\*(.+?)\*__/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<strong><em>${content}</em></strong>`);
			return placeholder;
		});
		
		text = text.replace(/_\*\*(.+?)\*\*_/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<em><strong>${content}</strong></em>`);
			return placeholder;
		});
		
		text = text.replace(/\*__(.+?)__\*/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<em><strong>${content}</strong></em>`);
			return placeholder;
		});
		
		// 4. Process regular bold
		text = text.replace(/\*\*([^*]+?)\*\*/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<strong>${content}</strong>`);
			return placeholder;
		});
		
		text = text.replace(/__([^_]+?)__/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<strong>${content}</strong>`);
			return placeholder;
		});
		
		// 5. Process regular italic with word boundary checks
		text = text.replace(/(?<![*\w])\*(?![*\s])([^*]+?)(?<![*\s])\*(?![*\w])/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<em>${content}</em>`);
			return placeholder;
		});
		
		text = text.replace(/(?<![_\w])_(?![_\s])([^_]+?)(?<![_\s])_(?![_\w])/g, (match, content) => {
			const placeholder = `\x00PROT${protectIndex++}\x00`;
			protectedContent.push(`<em>${content}</em>`);
			return placeholder;
		});
		
		// 6. Restore all protected content
		text = text.replace(/\x00PROT(\d+)\x00/g, (match, index) => {
			return protectedContent[parseInt(index)];
		});
		
		return text;
	}
	
	processBlockLevel(text: string, processInline: (text: string) => string): string {
		// Process headers
		text = text.replace(
			PATTERNS.headers,
			(_, hashes, content) =>
				`<h${hashes.length} class="markdown-h${hashes.length}">${processInline(
					content.trim()
				)}</h${hashes.length}>`
		);
		
		// Process blockquotes
		text = text.replace(
			PATTERNS.blockquote,
			(_, bqContent) =>
				`<blockquote class="markdown-blockquote">${processInline(bqContent)}</blockquote>`
		);
		
		return text;
	}
}