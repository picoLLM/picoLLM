import CodeHighlighter from '$components/ChatWindow/Messages/CodeHighlighter/CodeHighlighter.svelte';
import type ThinkBlock from '$components/ChatWindow/Messages/Thinking/Thinking.svelte';

export class CodeBlock {
	id: string;
	content: string;
	language: string;
	component?: CodeHighlighter;

	constructor(id: string, content: string, language: string) {
		this.id = id;
		this.content = content;
		this.language = language;
		this.component = undefined;
	}
}

export class ThinkBlockData {
	id: string;
	content: string;
	component?: ThinkBlock;

	constructor(id: string, content: string) {
		this.id = id;
		this.content = content;
		this.component = undefined;
	}
}

export class TableData {
	id: string;
	headers: string[];
	alignments: ('left' | 'center' | 'right' | null)[];
	rows: string[][];
	rawContent: string;
	isComplete: boolean;

	constructor(id: string) {
		this.id = id;
		this.headers = [];
		this.alignments = [];
		this.rows = [];
		this.rawContent = '';
		this.isComplete = false;
	}
}


export interface TextSegment {
    type: 'text' | 'code';
    content: string;
    html: string;
}