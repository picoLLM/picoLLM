import katex from 'katex';
import { KATEX_OPTIONS, PATTERNS } from '$lib/constants/markdown.constants';

export class MathProcessor {
	private renderMath(latex: string, displayMode: boolean): string {
		try {
			return katex.renderToString(latex, { ...KATEX_OPTIONS, displayMode });
		} catch (e) {
			console.error('KaTeX rendering error:', e);
			const escaped = latex.replace(/</g, '&lt;').replace(/>/g, '&gt;');
			return `<span class="math-error" title="LaTeX error">${displayMode ? '$$' + escaped + '$$' : '$' + escaped + '$'}</span>`;
		}
	}

	private isLikelyMath(content: string): boolean {
		return /\\|[_^{}]|\\[a-zA-Z]+/.test(content);
	}

	processMath(text: string): string {
		// Process block math
		text = text.replace(PATTERNS.math.block, (_, latex) => 
			`<div class="math-block" data-display-mode="true">${this.renderMath(latex.trim(), true)}</div>`
		);

		text = text.replace(PATTERNS.math.blockAlt, (_, latex) => 
			`<div class="math-block" data-display-mode="true">${this.renderMath(latex.trim(), true)}</div>`
		);

		// Process inline math with proper boundary detection
		const segments: string[] = [];
		let currentPos = 0;
		
		// Find all potential math expressions
		const regex = /\$([^\$\n]+?)\$/g;
		let match;
		
		while ((match = regex.exec(text)) !== null) {
			const content = match[1];
			const matchStart = match.index;
			const matchEnd = matchStart + match[0].length;
			
			// Check if this is likely currency (starts with digit or comma)
			if (/^[\d,]/.test(content)) {
				continue; // Skip currency
			}
			
			// Check if previous character is alphanumeric (likely currency context)
			if (matchStart > 0 && /[a-zA-Z0-9]/.test(text[matchStart - 1])) {
				continue; // Skip
			}
			
			// Check if it contains math indicators
			if (this.isLikelyMath(content)) {
				// Add text before math
				segments.push(text.substring(currentPos, matchStart));
				// Add rendered math
				segments.push(`<span class="math-inline" data-display-mode="false">${this.renderMath(content, false)}</span>`);
				currentPos = matchEnd;
			}
		}
		
		// Add remaining text
		segments.push(text.substring(currentPos));
		
		// Only use segments if we found math
		if (segments.length > 1) {
			text = segments.join('');
		}

		// Process \(...\) style math
		text = text.replace(PATTERNS.math.inlineAlt, (_, latex) => 
			`<span class="math-inline" data-display-mode="false">${this.renderMath(latex, false)}</span>`
		);

		return text;
	}
}