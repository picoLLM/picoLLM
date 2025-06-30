<script lang="ts">
	import { Clock, ChevronUp, ChevronDown, Zap, AlertCircle } from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import Token from '$components/Toolbox/Icons/Token.svelte';
	import type { MessageMetadata as MessageMetadataType } from '$lib/types/global';
	import WebSearchTags from './WebSearchTags.svelte';
	import SearchTooltip from './Tooltips.svelte';

	export let metadata: MessageMetadataType;

	let isExpanded = false;
	let activeTooltip: number | null = null;
	let tooltipLocked = false;

	// Core metadata checks
	$: hasWebSearch = Boolean(metadata?.web_search?.length);
	$: hasToolCalls = Boolean(metadata?.tool_calls?.length);
	$: hasExpandableContent = hasToolCalls || hasWebSearch;

	// Token info - handle both formats
	$: tokenInfo = (() => {
		if (!metadata?.usage) return null;
		const input = metadata.usage.input_tokens ?? metadata.usage.prompt_tokens ?? 0;
		const output = metadata.usage.output_tokens ?? metadata.usage.completion_tokens ?? 0;
		const total = input + output;
		return { input, output, total, display: `${input}/${output}` };
	})();

	// Performance metrics
	$: responseTime = metadata?.response_time;
	$: tokensPerSecond =
		tokenInfo && responseTime && responseTime > 0
			? Math.round(tokenInfo.output / responseTime)
			: null;

	// Tool status summary
	$: toolStatus = (() => {
		if (!hasToolCalls || !metadata.tool_calls) return null;

		let errorCount = 0;
		let successCount = 0;

		metadata.tool_calls.forEach((tc) => {
			const status = tc.function?.result?.status;
			const success = tc.function?.result?.result?.success;

			if (status === 'error' || success === false) {
				errorCount++;
			} else if (tc.function?.result) {
				successCount++;
			}
		});

		return {
			total: metadata.tool_calls.length,
			errors: errorCount,
			success: successCount,
			hasErrors: errorCount > 0
		};
	})();

	// Primary display text
	$: primaryDisplay = (() => {
		if (hasWebSearch) return null;

		if (toolStatus) {
			if (toolStatus.hasErrors) {
				return `${toolStatus.errors} tool error${toolStatus.errors > 1 ? 's' : ''}`;
			}
			return `${toolStatus.total} tool${toolStatus.total > 1 ? 's' : ''} executed`;
		}

		if (metadata?.model) {
			const cleanModel = metadata.model
				.replace('anthropic.', '')
				.replace('openai.', '')
				.replace('-', ' ');
			return cleanModel;
		}

		return null;
	})();

	function toggleExpand() {
		if (hasExpandableContent) {
			isExpanded = !isExpanded;
		}
	}

	function showTooltip(index: number) {
		if (!tooltipLocked) {
			activeTooltip = index;
		}
	}

	function hideTooltip() {
		if (!tooltipLocked) {
			activeTooltip = null;
		}
	}

	function toggleTooltip(e: MouseEvent, index: number) {
		e.preventDefault();
		e.stopPropagation();

		if (activeTooltip === index && tooltipLocked) {
			tooltipLocked = false;
			activeTooltip = null;
		} else {
			activeTooltip = index;
			tooltipLocked = true;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (tooltipLocked && !(e.target as Element).closest('.tooltip-trigger')) {
			tooltipLocked = false;
			activeTooltip = null;
		}
	}

	$: if (typeof window !== 'undefined') {
		window.addEventListener('click', handleClickOutside);

		() => {
			window.removeEventListener('click', handleClickOutside);
		};
	}
</script>

{#if metadata && (tokenInfo || responseTime || hasWebSearch || hasToolCalls)}
	<div class="message-footer" class:expanded={isExpanded} class:has-tools={hasToolCalls}>
		<button
			class="metadata-summary"
			class:expandable={hasExpandableContent}
			on:click={toggleExpand}
			disabled={!hasExpandableContent}
		>
			<div class="metadata-content">
				{#if toolStatus?.hasErrors}
					<AlertCircle size={14} class="error-icon" />
				{/if}

				{#if hasWebSearch}
					<WebSearchTags {metadata} />
				{:else if primaryDisplay}
					<span class="primary-text" class:subtle={!hasToolCalls}>
						{primaryDisplay}
					</span>
				{/if}

				<div class="metrics" class:metrics-only={!primaryDisplay && !hasWebSearch}>
					{#if tokenInfo}
						<div class="metric tokens">
							<Token size={12} />
							<span>{tokenInfo.total}</span>
						</div>
					{/if}

					{#if responseTime}
						<div class="metric time">
							<Clock size={14} />
							<span
								>{responseTime < 1
									? `${Math.round(responseTime * 1000)}ms`
									: `${responseTime.toFixed(1)}s`}</span
							>
						</div>
					{/if}

					{#if hasToolCalls && !hasWebSearch}
						<div class="metric tools" class:error={toolStatus?.hasErrors}>
							<Zap size={14} />
							<span>{toolStatus?.total || 0}</span>
						</div>
					{/if}

					{#if hasExpandableContent}
						<div class="expand-icon">
							{#if isExpanded}
								<ChevronUp size={14} />
							{:else}
								<ChevronDown size={14} />
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</button>

		{#if isExpanded && (hasToolCalls || hasWebSearch)}
			<div class="expanded-details" transition:slide|local={{ duration: 200 }}>
				{#if hasWebSearch && metadata.web_search}
					<div class="search-results">
						{#each metadata.web_search as result, i}
							<div class="search-result-wrapper">
								<a
									href={result.url}
									target="_blank"
									rel="noopener noreferrer"
									class="search-result"
								>
									<span class="search-source">{result.source || new URL(result.url).hostname}</span>
									<span class="search-title">{result.title}</span>
								</a>
								{#if result.snippet}
									<SearchTooltip
										snippet={result.snippet}
										index={i}
										active={activeTooltip === i}
										locked={tooltipLocked}
										onShow={showTooltip}
										onHide={hideTooltip}
										onToggle={toggleTooltip}
									/>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if hasToolCalls && metadata.tool_calls && !hasWebSearch}
					<div class="tool-details">
						{#each metadata.tool_calls as toolCall}
							{@const hasError =
								toolCall.function?.result?.status === 'error' ||
								toolCall.function?.result?.result?.success === false}
							<div class="tool-item" class:error={hasError}>
								<span class="tool-name">{toolCall.function?.name || 'Unknown'}</span>
								{#if hasError}
									<span class="tool-status error">Error</span>
								{:else if toolCall.function?.result}
									<span class="tool-status success">Complete</span>
								{:else}
									<span class="tool-status pending">Pending</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	@import '../../../../lib/styles/components/ChatWindow/MessageFooter/message-footer.css';
</style>
