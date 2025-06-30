<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$components/Sidebar/Sidebar.svelte';
	import ChatWindow from '$components/ChatWindow/ChatWindow.svelte';
	import MessageInput from '$components/MessageInput/MessageInput.svelte';
	import { settingsStore } from '$lib/stores/settings';
	import TopBar from '$components/TopBar/TopBar.svelte';
	import { chatStore } from '$lib/stores/chat';
	import type { ChatSession } from '$lib/types/global';
	import type { Settings } from '$lib/types/settings';
	import { picoLLMService } from '$lib/services/chat/chat';

	let isGeneratingAssistantMessage = false;
	let isSettingsPanelOpen = false;
	let messageInputComponent: MessageInput;
	let selectedSuggestion: string = '';

	$: apiUrl = $settingsStore.baseUrl;

	$: ({ sessions, currentSessionId, hasMoreMessages } = $chatStore);

	// Update flag to indicate generating status
	$: isGeneratingAssistantMessage = $chatStore.isGeneratingMessage;

	onMount(async () => {
		await picoLLMService.initialize();
	});

	// Handle the sendMessage event
	async function handleSendMessage(event: CustomEvent<{ text: string; hasImage: boolean }>) {
		const { text: query } = event.detail;
		await picoLLMService.sendMessage(query, messageInputComponent);
	}

	function handleSelectChat(event: CustomEvent<string>) {
		picoLLMService.selectChat(event.detail);
	}

	function handleDeleteSession(event: CustomEvent<string>) {
		picoLLMService.deleteSession(event.detail);
	}

	function toggleSettings() {
		isSettingsPanelOpen = !isSettingsPanelOpen;
	}

	async function handleCreateNewChat(event: CustomEvent<ChatSession>) {
		await picoLLMService.createNewChat(event.detail);
	}

	function handleUpdateSession(event: CustomEvent<ChatSession>) {
		picoLLMService.updateSession(event.detail);
	}

	function handleUpdateSettings(event: CustomEvent<Partial<Settings>>) {
		picoLLMService.updateSettings(event.detail);
	}

	function handleLoadMore() {
		picoLLMService.loadMoreMessages();
	}

	function handlePrefillMessage(event: CustomEvent<string>) {
		selectedSuggestion = event.detail;
		if (messageInputComponent) {
			messageInputComponent.focus();
		}
	}
</script>

<div class="chat-layout">
	<Sidebar
		{currentSessionId}
		on:newChat={handleCreateNewChat}
		on:selectChat={handleSelectChat}
		on:deleteSession={handleDeleteSession}
		on:updateSession={handleUpdateSession}
	/>
	<div class="main-container">
		<TopBar on:toggleSettings={toggleSettings} />
		<div class="chat-and-settings-container">
			<ChatWindow
				{currentSessionId}
				{isSettingsPanelOpen}
				on:prefillMessage={handlePrefillMessage}
				on:loadMore={handleLoadMore}
				on:toggleSettings={toggleSettings}
				on:updateSettings={handleUpdateSettings}
			/>
		</div>
		<div class="message-input-wrapper" class:settings-open={isSettingsPanelOpen}>
			<MessageInput
				on:sendMessage={handleSendMessage}
				bind:this={messageInputComponent}
				prefillMessage={selectedSuggestion}
			/>
		</div>
	</div>
</div>

<style>
	@import '../lib/styles/layout.css';
</style>