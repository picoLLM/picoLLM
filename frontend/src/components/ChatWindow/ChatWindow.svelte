<script lang="ts">
	import {
		scrollHandler,
		scrollToBottom,
		autoScrollEnabled,
		type ScrollableElement
	} from '$lib/utils/actions/scroll';
	import { createChatViewModel } from '$lib/services/chat/chat-view-model';
	import { createChatEvents } from '$lib/services/chat/chat-events';
	import { onMount, onDestroy } from 'svelte';
	import type { ChatWindowProps } from '$lib/types/ui';
	// Components
	import SuggestionBoxes from './SuggestionBoxes/SuggestionBoxes.svelte';
	import ToolSettingsMenu from '$components/ToolSettingsMenu/ToolSettingsMenu.svelte';
	import ChatMessage from './Messages/Message.svelte';
	import LoadingAnimation from './Loading/LoadingAnimation.svelte';
	import LoadingMessage from './Loading/LoadingMessage.svelte';
	
	// Component Props
	export let currentSessionId: ChatWindowProps['currentSessionId'] = null;
	export let isSettingsPanelOpen: ChatWindowProps['isSettingsPanelOpen'] = false;
	const SCROLL_THRESHOLD = 80;
	// State
	let chatWindowElement: ScrollableElement;
	let showScrollDownButton = false;
	let selectedSuggestion = '';
	let prevMessagesLength = 0;
	let prevStreamingState = false;
	let scrollDebounceTimeout: ReturnType<typeof setTimeout>;
	
	// Initialize services
	const viewModel = createChatViewModel();
	const {
		handleSuggestionSelect,
		handleToggleSettings,
		handleUpdateSettings,
		createTransitionHandlers
	} = createChatEvents();
	const { isTransitioning, handleTransitionStart, handleTransitionEnd } =
		createTransitionHandlers();

	// Reactive properties
	$: ({ messages, isGeneratingMessage, isLoadingMessages, lastMessage, isStreaming } = $viewModel);

	// Optimized scroll handling
	$: if (chatWindowElement && messages) {
		const newMessagesAdded = messages.length > prevMessagesLength;
		const streamingStarted = isStreaming && !prevStreamingState;
		const streamingActive = isStreaming && prevStreamingState;
		const streamingEnded = !isStreaming && prevStreamingState;

		// Clear existing timeout
		if (scrollDebounceTimeout) clearTimeout(scrollDebounceTimeout);

		if (streamingEnded) {
			// Stop any ongoing scroll animation immediately
			chatWindowElement?.stopScrolling?.();
		} else if (newMessagesAdded && !isStreaming) {
			// New message from user or complete AI response - force scroll
			scrollDebounceTimeout = setTimeout(() => {
				chatWindowElement?.forceScroll?.();
			}, 100);
		} else if (streamingStarted) {
			// Stream just started - initial scroll
			scrollDebounceTimeout = setTimeout(() => {
				chatWindowElement?.forceScroll?.();
			}, 50);
		} else if (streamingActive) {
			// During streaming - use smooth incremental scroll
			chatWindowElement?.checkAndScroll?.();
		}

		prevMessagesLength = messages.length;
		prevStreamingState = isStreaming;
	}

	// Scroll to bottom initially
	onMount(() => {
		if (chatWindowElement) {
			scrollToBottom(chatWindowElement, { force: true });
		}
	});

	// Cleanup
	onDestroy(() => {
		if (scrollDebounceTimeout) clearTimeout(scrollDebounceTimeout);
	});

	// Handle settings panel transitions
	$: if (isSettingsPanelOpen !== undefined) {
		handleTransitionStart();
	}

	function onSuggestionSelect(event: CustomEvent<string>) {
		selectedSuggestion = handleSuggestionSelect(event);
	}

	function handleScrollChange(shouldShow: boolean) {
		// Only show button if there's actual scrollable content
		if (chatWindowElement) {
			const canScroll = chatWindowElement.scrollHeight > chatWindowElement.clientHeight + SCROLL_THRESHOLD;
			showScrollDownButton = shouldShow && canScroll;
		} else {
			showScrollDownButton = false;
		}
	}

	function smoothScrollToBottom() {
		if (chatWindowElement) {
			scrollToBottom(chatWindowElement, { smooth: true });
			autoScrollEnabled.set(true);
		}
	}

	// Check if content is scrollable after mount and updates
	function checkScrollable() {
		if (chatWindowElement) {
			const canScroll = chatWindowElement.scrollHeight > chatWindowElement.clientHeight + SCROLL_THRESHOLD;
			if (!canScroll) {
				showScrollDownButton = false;
			}
		}
	}

	// Check scrollability after DOM updates
	$: if (messages && chatWindowElement) {
		requestAnimationFrame(checkScrollable);
	}
</script>

<div
	class="chat-container"
	class:settings-open={isSettingsPanelOpen}
	class:transitioning={isTransitioning}
	on:transitionend={handleTransitionEnd}
>
	<div
		class="chat-window"
		bind:this={chatWindowElement}
		use:scrollHandler={{ threshold: SCROLL_THRESHOLD, onScroll: handleScrollChange }}
	>
		<div class="messages-wrapper">
			{#if isLoadingMessages}
				<div class="loading-messages">
					<LoadingAnimation size="large" />
					<p>Loading messages...</p>
				</div>
			{:else if !currentSessionId}
				<div class="no-chat-selected">
					<SuggestionBoxes on:selectSuggestion={onSuggestionSelect} />
				</div>
			{:else if messages.length === 0 && !isGeneratingMessage}
				<div class="empty-chat">
					<SuggestionBoxes on:selectSuggestion={onSuggestionSelect} />
				</div>
			{:else}
				<div class="message-list">
					{#each messages as message (message.id || message.tempId)}
						<div class="message-item" class:is-last={message === lastMessage}>
							<ChatMessage
								{message}
								isLastMessage={message === lastMessage}
								{isGeneratingMessage}
							/>
						</div>
					{/each}
					{#if isGeneratingMessage && !isStreaming}
						<div class="message-item">
							<LoadingMessage />
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if isSettingsPanelOpen}
		<ToolSettingsMenu
			{isGeneratingMessage}
			on:toggleSettings={handleToggleSettings}
			on:updateSettings={handleUpdateSettings}
		/>
	{/if}

	{#if showScrollDownButton}
		<button
			class="scroll-down-button"
			class:transitioning={isTransitioning}
			on:click={smoothScrollToBottom}
			aria-label="Scroll to bottom"
		>
			↓
		</button>
	{/if}
</div>

<style>
	@import '../../lib/styles/components/ChatWindow/chat-window.css';
</style>