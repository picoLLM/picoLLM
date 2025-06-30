export const PATTERNS = {
	headers: /^(#{1,6})\s+(.+)$/gm,
	lists: {
		ordered: /^(\s*)(\d+)\.\s+(.+)$/,
		unordered: /^(\s*)[*+-]\s+(.+)$/
	},
	emphasis: /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g,
	inlineCode: /`([^`\n]+?)`/g,
	links: /\[([^\]]+)\]\(([^)]+)\)/g,
	images: /!\[([^\]]*)\]\(([^)]+)\)/g,
	blockquote: /^>\s+(.+)$/gm,
	codeBlock: /^```/,
	thinkStart: /<think/,
	thinkEnd: /<\/think>/,
	hr: /^(={3,}|-{3,})\s*$/,
	blockLevel: /^<(h[1-6]|ul|ol|blockquote|div|table)/,
	table: {
		row: /^\|(.+)\|$/,
		separator: /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/
	},
	// Simplified math patterns
	math: {
		// Only match inline math that has clear math indicators
		inline: /\$([^\$\n]+)\$/g,
		block: /\$\$([\s\S]+?)\$\$/gm,
		blockAlt: /^\\\[([\s\S]+?)\\\]$/gm,
		inlineAlt: /\\\((.+?)\\\)/g
	},
	// Normalization patterns
	norm: {
		multi: /\n{3,}/g,
		header: /(\n#{1,6}\s.*)\n+/g,
		list: /(\n[*+-]\s+.*)\n{2,}(?=[*+-]\s+)/g,
		orderedList: /(\n\d+\.\s+.*)\n{2,}(?=\d+\.\s+)/g,
		preList: /([^\n])\n([*+-]\s+|\d+\.\s+)/g,
		preCode: /([^\n])\n```/g,
		codeBlock: /```(.*?)\n([\s\S]*?)```/g,
		extraCode: /```\n\n/g,
		trailing: /\s+(<\/[^>]+>)$/,
		whitespace: />\s+</g
	}
};

// DOMPurify config - create once
export const PURIFY_CONFIG = {
	ADD_TAGS: ['div', 'p', 'br', 'strong', 'em', 'code', 'details', 'summary', 'hr', 'img', 'span', 'math', 'annotation', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mroot', 'msqrt', 'mtext', 'mspace', 'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd'],
	ADD_ATTR: ['class', 'id', 'open', 'href', 'src', 'alt', 'title', 'data-math', 'data-display-mode'],
	ALLOW_DATA_ATTR: false,
	ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
};

// Math rendering options
export const KATEX_OPTIONS = {
	throwOnError: false,
	displayMode: false,
	trust: false,
	strict: false,
	output: 'html' as const,
	fleqn: false,
	macros: {
		"\\RR": "\\mathbb{R}",
		"\\NN": "\\mathbb{N}",
		"\\ZZ": "\\mathbb{Z}",
		"\\QQ": "\\mathbb{Q}",
		"\\CC": "\\mathbb{C}"
	}
};