<!-- Header.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Plus from '$components/Toolbox/Icons/Plus.svelte';
	import PanelLeftClose from '$components/Toolbox/Icons/PanelLeftClose.svelte';
	import PanelLeftOpen from '$components/Toolbox/Icons/PanelLeftOpen.svelte';
	import Paw from '$components/Toolbox/Icons/Paw.svelte';

	export let isSidebarCollapsed: boolean;

	const dispatch = createEventDispatcher<{
		newChat: void;
		toggle: void;
	}>();
</script>

<div class="sidebar-header">
	<div class="logo">
		{#if !isSidebarCollapsed}
			PicoLLM
			<Paw />
		{/if}
	</div>

	<div class="header-controls">
		<button 
			class="new-chat-btn" 
			on:click={() => dispatch('newChat')} 
			aria-label="Create new chat"
		>
			<Plus size={20} />
		</button>
		<button
			class="toggle-sidebar"
			on:click={() => dispatch('toggle')}
			aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			{#if isSidebarCollapsed}
				<PanelLeftOpen />
			{:else}
				<PanelLeftClose />
			{/if}
		</button>
	</div>
</div>

<style>
@import '../../lib/styles/components/Sidebar/header.css';
</style>