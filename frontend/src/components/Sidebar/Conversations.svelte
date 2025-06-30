<!-- Conversations.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Pencil from '$components/Toolbox/Icons/Pencil.svelte';
	import X from '$components/Toolbox/Icons/X.svelte';
	import type { ChatSession } from '$lib/types/global';

	export let chatSessions: ChatSession[] = [];
	export let currentSessionId: string | null = null;

	const dispatch = createEventDispatcher<{
		select: string;
		rename: ChatSession;
		delete: ChatSession;
	}>();
</script>

<div class="chat-sessions">
	{#if chatSessions.length > 0}
		<ul>
			{#each chatSessions as session (session.id)}
				<li class:active={session.id === currentSessionId}>
					<button
						class="chat-session-button"
						on:click={() => dispatch('select', session.id)}
					>
						{session.name || ''}
					</button>
					<div class="chat-actions">
						<button
							class="icon-button"
							on:click={() => dispatch('rename', session)}
							aria-label="Rename chat"
						>
							<Pencil size={16} />
						</button>
						<button
							class="icon-button"
							on:click={() => dispatch('delete', session)}
							aria-label="Delete chat"
						>
							<X size={16} />
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="no-chats">No chat sessions yet.</p>
	{/if}
</div>

<style>
@import '../../lib/styles/components/Sidebar/conversations.css';
</style>