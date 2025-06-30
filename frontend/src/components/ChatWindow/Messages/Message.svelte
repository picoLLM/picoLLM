<script lang="ts">
	import { onMount } from 'svelte';
	import type { Message, ToolCall, MessageMetadata } from '$lib/types/global';
	import MessageFooter from './MessageFooter/MessageFooter.svelte';
	import Markdown from './Markdown/Markdown.svelte';
	import LoadingAnimation from '../Loading/LoadingAnimation.svelte';
	import ToolExecution from './ToolExecution.svelte';

	// Props
	export let message: Message;
	export let isLastMessage: boolean;
	export let isGeneratingMessage: boolean;

	// State - minimized to essentials
	let accumulatedContent = '';
	let contentSegments: Array<{ type: 'content' | 'tool'; content?: string; toolIndex?: number }> = [];

	$: ({
		isAssistantStreaming,
		showLoading,
		showContent,
		hasImage,
		activeToolCall,
		processedMetadata
	} = (() => {
		const isAssistantStreaming =
			isLastMessage && isGeneratingMessage && message.role === 'assistant';
		const hasContent = message.content && message.content.length > 0;

		return {
			isAssistantStreaming,
			showLoading: isAssistantStreaming && !hasContent,
			showContent:
				message.role === 'user' ||
				(message.role === 'assistant' && (hasContent || !isGeneratingMessage)),
			hasImage: Boolean(message.metadata?.hasImage && message.metadata?.imagePreview),
			activeToolCall: getActiveToolCall(isAssistantStreaming, message.metadata?.tool_calls),
			processedMetadata: extractMetadata(message.metadata)
		};
	})());

	// Extract active tool call - keep existing Anthropic logic unchanged
	function getActiveToolCall(streaming: boolean, toolCalls?: ToolCall[]): ToolCall | null {
		if (!streaming || !toolCalls?.length) return null;
		const lastTool = toolCalls[toolCalls.length - 1];
		return !lastTool.function?.result ? lastTool : null;
	}

	function extractMetadata(metadata?: MessageMetadata | null): MessageMetadata | null {
		if (!metadata) return null;
		if (!metadata.tool_calls?.length) return metadata;

		const processed = { ...metadata };
		for (const tc of metadata.tool_calls) {
			if (tc.function?.name === 'web_search' && tc.function?.result) {
				const results = tc.function.result?.result?.results || tc.function.result?.results;
				if (Array.isArray(results) && results.length) {
					processed.web_search = results.map((r) => ({
						title: r.title || '',
						url: r.url || '',
						snippet: r.content || r.snippet || r.description || '',
						source: r.source || extractDomain(r.url),
						published_date: r.published_date || null
					}));
					break;
				}
			}
		}

		return processed;
	}
	function extractDomain(url?: string): string {
		if (!url) return '';
		try {
			const match = url.match(/^https?:\/\/([^\/]+)/);
			return match ? match[1] : '';
		} catch {
			return '';
		}
	}
	function updateContentSegments(content: string, positions?: number[], hasTools?: boolean) {
		if (!hasTools || !positions?.length) {
			contentSegments = [{ type: 'content', content }];
			return;
		}
		const sortedPositions = [...positions].sort((a, b) => a - b);
		const segments: typeof contentSegments = [];
		let lastPos = 0;

		sortedPositions.forEach((pos, index) => {
			// Add content before this tool position
			if (pos > lastPos) {
				const contentBefore = content.substring(lastPos, pos).trim();
				if (contentBefore) {
					segments.push({ type: 'content', content: contentBefore });
				}
			}
			
			// Add tool placeholder
			segments.push({ type: 'tool', toolIndex: index });
			lastPos = pos;
		});

		// Add any remaining content after the last tool
		if (lastPos < content.length) {
			const contentAfter = content.substring(lastPos).trim();
			if (contentAfter) {
				segments.push({ type: 'content', content: contentAfter });
			}
		}

		contentSegments = segments;
	}

	// Single reactive update for content
	$: if (message.content !== accumulatedContent) {
		accumulatedContent = message.content || '';
		updateContentSegments(
			accumulatedContent,
			message.metadata?.tool_positions,
			Boolean(message.metadata?.tool_calls?.length)
		);
	}

	// Lifecycle
	onMount(() => {
		if (message.content) {
			accumulatedContent = message.content;
			updateContentSegments(
				accumulatedContent,
				message.metadata?.tool_positions,
				Boolean(message.metadata?.tool_calls?.length)
			);
		}
	});
</script>

<div class="message-container {message.role}" class:is-streaming={isAssistantStreaming}>
	<div class="message">
		{#if showLoading}
			<div class="message-content loading">
				<LoadingAnimation size="small" />
			</div>
		{:else if showContent}
			<div class="message-content">
				{#if hasImage && message.metadata}
					<div class="image-container">
						<img
							src={typeof message.metadata.imagePreview === 'string'
								? message.metadata.imagePreview
								: ''}
							alt={message.metadata.imageInfo?.filename || 'Uploaded image'}
							class="message-image"
						/>
					</div>
				{/if}

				<div class="content-wrapper">
					{#if contentSegments.length > 1 && contentSegments.some(s => s.type === 'tool')}
						<!-- Multiple segments with inline tools -->
						{#each contentSegments as segment, i}
							{#if segment.type === 'content' && segment.content}
								<div class="markdown-with-cursor">
									<Markdown
										content={segment.content}
										messageId="{message.id || message.tempId || ''}-seg-{i}"
									/>
								</div>
							{:else if segment.type === 'tool' && message.metadata?.tool_calls}
								{@const toolCall = message.metadata.tool_calls[segment.toolIndex || 0]}
								<div class="inline-tool-execution">
									{#if toolCall}
										<ToolExecution 
											{toolCall} 
											isActive={activeToolCall === toolCall}
										/>
									{/if}
								</div>
							{/if}
						{/each}
					{:else}
		
							<Markdown
								content={accumulatedContent}
								messageId={message.id || message.tempId || ''}
							/>
					

						{#if message.metadata?.tool_calls?.length}
							<div class="tool-execution-container">
								{#if activeToolCall}
									<ToolExecution toolCall={activeToolCall} isActive={true} />
								{:else}
									{#each message.metadata.tool_calls as toolCall}
										<ToolExecution {toolCall} isActive={false} />
									{/each}
								{/if}
							</div>
						{/if}
					{/if}
				</div>
			</div>

			{#if message.role === 'assistant' && processedMetadata}
				<MessageFooter metadata={processedMetadata} />
			{/if}
		{/if}
	</div>
</div>

<style>
	@import '../../../lib/styles/components/ChatWindow/Messages/markdown.css';
	@import '../../../lib/styles/components/ChatWindow/Messages/message.css';
	@import '../../../lib/styles/components/ChatWindow/Messages/message-with-code.css';
</style>