<!-- Sidebar.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import type { ChatSession } from '$lib/types/global';
	import { chatStore } from '$lib/stores/chat';
	import Header from './Header.svelte';
	import Conversations from './Conversations.svelte';
	import Actions from './Actions.svelte';
	import DeleteChatModal from '$components/Toolbox/Modals/DeleteChatModal.svelte';
	import RenameChatModal from '$components/Toolbox/Modals/RenameChatModal.svelte';
	import { SidebarManager } from '$lib/api/sidebar';

	export let currentSessionId: string | null = null;
	export let isSidebarCollapsed = false;

	const dispatch = createEventDispatcher<{
		newChat: ChatSession;
		selectChat: string;
		deleteSession: string;
		updateSession: ChatSession;
		toggleCollapse: boolean;
	}>();

	$: chatSessions = $chatStore.sessions;

	// Modal state
	let isDeleteModalOpen = false;
	let isRenameModalOpen = false;
	let selectedSession: ChatSession | null = null;

	async function handleNewChat() {
		try {
			const newSession = await SidebarManager.createNewChat();
			dispatch('newChat', newSession);
		} catch (error) {
			console.error('Error creating new chat:', error);
		}
	}

	function handleSelectChat(event: CustomEvent<string>) {
		dispatch('selectChat', event.detail);
	}

	function handleRenameRequest(event: CustomEvent<ChatSession>) {
		selectedSession = event.detail;
		isRenameModalOpen = true;
	}

	function handleDeleteRequest(event: CustomEvent<ChatSession>) {
		selectedSession = event.detail;
		isDeleteModalOpen = true;
	}

	async function handleRename(event: CustomEvent<string>) {
		if (!selectedSession) return;
		try {
			const updatedSession = await SidebarManager.renameChatSession(
				selectedSession.id,
				event.detail
			);
			dispatch('updateSession', updatedSession);
			isRenameModalOpen = false;
		} catch (error) {
			console.error('Error renaming chat session:', error);
		}
	}

	async function handleDelete() {
		if (!selectedSession) return;
		try {
			await SidebarManager.deleteChatSession(selectedSession.id);
			dispatch('deleteSession', selectedSession.id);
			isDeleteModalOpen = false;
		} catch (error) {
			console.error('Error deleting chat session:', error);
		}
	}

	function handleToggle() {
		isSidebarCollapsed = !isSidebarCollapsed;
		dispatch('toggleCollapse', isSidebarCollapsed);
	}

	function handleNavigation(event: CustomEvent<string>) {
		goto(event.detail);
	}
</script>

<aside class="sidebar" class:collapsed={isSidebarCollapsed}>
	<Header 
		{isSidebarCollapsed}
		on:newChat={handleNewChat}
		on:toggle={handleToggle}
	/>

	{#if !isSidebarCollapsed}
		<Conversations
			{chatSessions}
			{currentSessionId}
			on:select={handleSelectChat}
			on:rename={handleRenameRequest}
			on:delete={handleDeleteRequest}
		/>
	{/if}

	<Actions
		{isSidebarCollapsed}
		on:navigate={handleNavigation}
	/>
</aside>

{#if selectedSession}
	<RenameChatModal
		isOpen={isRenameModalOpen}
		currentName={selectedSession.name || ''}
		on:close={() => (isRenameModalOpen = false)}
		on:rename={handleRename}
	/>

	<DeleteChatModal
		isOpen={isDeleteModalOpen}
		chatName={selectedSession.name || ''}
		on:close={() => (isDeleteModalOpen = false)}
		on:confirm={handleDelete}
	/>
{/if}

<style>
	@import '../../lib/styles/components/Sidebar/sidebar.css';
</style>