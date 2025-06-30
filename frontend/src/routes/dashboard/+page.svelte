<!-- src/routes/configure/+page.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowBigLeft } from 'lucide-svelte';
	import Badge from '../../components/Toolbox/Badges/Badge.svelte';
	import ConfigurePanel from './components/ConfigurePanel.svelte';
	import SearchPanel from './components/SearchPanel.svelte';
	import StatsPanel from './components/StatsPanel.svelte';
	import { buildStore } from './stores/build';
	import { statsStore } from './stores/stats';
	import { badgePresets } from '$lib/constants/dashboard.constants';
	import type { BuildStatus } from '$lib/types/configure';
	import { onMount } from 'svelte';
	import Dashboard from '$components/Toolbox/Icons/Dashboard.svelte';

	onMount(() => {
		statsStore.loadStats();
	});

	function getBuildStatus(): BuildStatus | null {
		if ($buildStore.error) return 'error';
		if ($buildStore.isBuilding) return 'pending';
		if ($buildStore.progress?.status === 'completed') return 'active';
		return null;
	}
</script>

<div class="dashboard-root-container">
	<header class="dashboard-header-bar">
		<button class="dashboard-back-button" on:click={() => goto('/')}>
			<ArrowBigLeft size={20} />
			<span class="dashboard-back-text">Back</span>
		</button>
		<div class="dashboard-title-group">
			<Dashboard size={20} />
			<span>Dashboard</span>
			{#if getBuildStatus()}
				{@const status = getBuildStatus()}
				{#if status}
					<Badge {...badgePresets[status]} className="ml-2">
						{status}
					</Badge>
				{/if}
			{/if}
		</div>
	</header>

	<main class="dashboard-main-area">
		<div class="dashboard-layout-grid">
			<div class="dashboard-left-column">
				<div class="dashboard-configure-slot">
					<ConfigurePanel />
				</div>
				<div class="dashboard-stats-slot">
					<StatsPanel />
				</div>
			</div>
			<div class="dashboard-right-column">
				<SearchPanel />
			</div>
		</div>
	</main>
</div>

<style>
	/* Reset and isolate all dashboard styles */
	.dashboard-root-container {
		all: initial;
		width: 100vw;
		height: 100vh;
		background-color: #0a0a0a;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		color: #ffffff;
		box-sizing: border-box;
	}

	.dashboard-root-container * {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	/* Header */
	.dashboard-header-bar {
		all: initial;
		display: flex;
		align-items: center;
		gap: 1.5rem;
		height: 56px;
		padding: 0 1.5rem;
		background-color: #111111;
		border-bottom: 1px solid #222222;
		flex-shrink: 0;
		font-family: inherit;
		color: inherit;
		box-sizing: border-box;
	}

	.dashboard-back-button {
		all: initial;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #007aff;
		cursor: pointer;
		padding: 0.5rem;
		font-size: 0.875rem;
		font-family: inherit;
		background: transparent;
		border: none;
		outline: none;
		box-sizing: border-box;
	}

	.dashboard-back-button:hover {
		opacity: 0.8;
	}

	.dashboard-back-text {
		display: inline;
	}

	.dashboard-title-group {
		all: initial;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #ffffff;
		font-size: 1.125rem;
		font-weight: 600;
		font-family: inherit;
		box-sizing: border-box;
	}

	/* Main content */
	.dashboard-main-area {
		all: initial;
		flex: 1;
		padding: 1.5rem;
		overflow: hidden;
		font-family: inherit;
		color: inherit;
		box-sizing: border-box;
		display: block;
	}

	.dashboard-layout-grid {
		all: initial;
		display: grid;
		grid-template-columns: 380px 1fr;
		gap: 1.5rem;
		max-width: 1600px;
		margin: 0 auto;
		height: 100%;
		font-family: inherit;
		color: inherit;
		box-sizing: border-box;
	}

	.dashboard-left-column {
		all: initial;
		display: grid;
		grid-template-rows: auto auto;
		gap: 1.5rem;
		overflow: hidden;
		font-family: inherit;
		color: inherit;
		box-sizing: border-box;
		align-content: start;
	}

	.dashboard-configure-slot,
	.dashboard-stats-slot,
	.dashboard-right-column {
		all: initial;
		display: block;
		min-height: 0;
		overflow: hidden;
		font-family: inherit;
		color: inherit;
		box-sizing: border-box;
	}

	/* Panel styling - using highly specific selectors */
	.dashboard-configure-slot > :global(*),
	.dashboard-right-column > :global(*) {
		background-color: #1a1a1a !important;
		border: 1px solid #2a2a2a !important;
		border-radius: 12px !important;
		padding: 1.25rem !important;
		height: 100% !important;
		display: flex !important;
		flex-direction: column !important;
		overflow: hidden !important;
		box-shadow: none !important;
		transform: none !important;
		transition: none !important;
		animation: none !important;
		position: static !important;
		top: auto !important;
		left: auto !important;
		right: auto !important;
		bottom: auto !important;
		margin: 0 !important;
		font-family: inherit !important;
		color: inherit !important;
		box-sizing: border-box !important;
	}

	/* Special styling for stats panel with reduced padding */
	.dashboard-stats-slot > :global(*) {
		background-color: #1a1a1a !important;
		border: 1px solid #2a2a2a !important;
		border-radius: 12px !important;
		padding: 0.875rem !important;
		height: auto !important;
		display: flex !important;
		flex-direction: column !important;
		overflow: hidden !important;
		box-shadow: none !important;
		transform: none !important;
		transition: none !important;
		animation: none !important;
		position: static !important;
		top: auto !important;
		left: auto !important;
		right: auto !important;
		bottom: auto !important;
		margin: 0 !important;
		font-family: inherit !important;
		color: inherit !important;
		box-sizing: border-box !important;
	}

	/* Override any lingering panel transitions */
	:global(.page-container .panel),
	:global(.panel) {
		transition: none !important;
	}

	/* Disable all hover effects on panels */
	.dashboard-configure-slot > :global(*:hover),
	.dashboard-stats-slot > :global(*:hover),
	.dashboard-right-column > :global(*:hover) {
		transform: none !important;
		box-shadow: none !important;
		border-color: #2a2a2a !important;
		background-color: #1a1a1a !important;
	}

	/* Panel headers and content */
	.dashboard-root-container :global(.panel-header) {
		display: flex !important;
		align-items: center !important;
		gap: 0.5rem !important;
		margin-bottom: 1rem !important;
		color: #ffffff !important;
		flex-shrink: 0 !important;
		transform: none !important;
		transition: none !important;
		animation: none !important;
	}

	.dashboard-root-container :global(.panel-header h3) {
		font-size: 0.875rem !important;
		font-weight: 600 !important;
		margin: 0 !important;
	}

	.dashboard-root-container :global(.panel-content) {
		flex: 1 !important;
		overflow: auto !important;
		min-height: 0 !important;
		transform: none !important;
		transition: none !important;
		animation: none !important;
	}

	/* Scrollbar styling */
	.dashboard-root-container :global(.panel-content::-webkit-scrollbar),
	.dashboard-main-area::-webkit-scrollbar {
		width: 8px;
	}

	.dashboard-root-container :global(.panel-content::-webkit-scrollbar-track),
	.dashboard-main-area::-webkit-scrollbar-track {
		background: #0a0a0a;
	}

	.dashboard-root-container :global(.panel-content::-webkit-scrollbar-thumb),
	.dashboard-main-area::-webkit-scrollbar-thumb {
		background: #333333;
		border-radius: 4px;
	}

	.dashboard-root-container :global(.panel-content::-webkit-scrollbar-thumb:hover),
	.dashboard-main-area::-webkit-scrollbar-thumb:hover {
		background: #444444;
	}

	/* Responsive design */
	@media (max-width: 1200px) {
		.dashboard-layout-grid {
			grid-template-columns: 320px 1fr;
		}
	}

	@media (max-width: 968px) {
		.dashboard-layout-grid {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.dashboard-left-column {
			grid-template-columns: 1fr 1fr;
			grid-template-rows: auto;
		}

		.dashboard-right-column {
			max-height: 400px;
		}
	}

	@media (max-width: 768px) {
		.dashboard-main-area {
			padding: 1rem;
		}

		.dashboard-layout-grid {
			gap: 1rem;
		}

		.dashboard-left-column {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.dashboard-back-text {
			display: none;
		}
	}
</style>