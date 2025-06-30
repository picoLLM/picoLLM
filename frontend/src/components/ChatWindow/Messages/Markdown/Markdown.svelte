<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { MarkdownService } from '$lib/services/markdown/markdown';

	/* ------------------------- Props -------------------------- */
	export let content: string = '';
	export let messageId: string = '';
	export let isStreaming: boolean = false;

	/* ------------------------- State -------------------------- */
	let mounted = false;
	let renderedContent = '';
	let processingUpdate = false;
	
	// Initialize the markdown service
	let markdownService = new MarkdownService(messageId);

	async function updateContent() {
		if (!mounted || processingUpdate) return;
		processingUpdate = true;
		try {
			const normalized = markdownService.normalizeStreamContent(content, isStreaming).trimEnd();
			const processed = markdownService.processMarkdown(normalized, isStreaming, tick).trim();
			if (!isStreaming || !renderedContent) {
				renderedContent = markdownService.sanitizeContent(processed);
			}
		} finally {
			processingUpdate = false;
		}
	}

	onMount(() => {
		mounted = true;
		void updateContent();
	});

	onDestroy(() => {
		mounted = false;
		markdownService.destroyComponents();
	});

	$: if (mounted && content) {
		void updateContent();
	}
</script>

<!-- We still use `{@html renderedContent}` to display the sanitized result. -->
{@html renderedContent}