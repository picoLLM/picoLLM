<!-- src/routes/configure/components/StatsPanel.svelte -->
<script lang="ts">
	import { Database, Activity, HardDrive } from 'lucide-svelte';
	import { statsStore } from '../stores/stats';
	import { onMount } from 'svelte';

	onMount(() => {
		// Refresh stats every 30 seconds
		const interval = setInterval(() => {
			statsStore.loadStats();
		}, 30000);
		return () => clearInterval(interval);
	});
</script>

<div class="panel stats-panel">
	<div class="panel-header">
		<Database size={16} />
		<h3>Database Overview</h3>
	</div>
	
	<div class="panel-content">
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon">
					<Database size={18} />
				</div>
				<div class="stat-content">
					<span class="stat-value">{$statsStore.totalCollections}</span>
					<span class="stat-label">Collections</span>
				</div>
			</div>
			
			<div class="stat-card">
				<div class="stat-icon">
					<Activity size={18} />
				</div>
				<div class="stat-content">
					<span class="stat-value">{$statsStore.totalPoints.toLocaleString()}</span>
					<span class="stat-label">Total Points</span>
				</div>
			</div>
			
			<div class="stat-card">
				<div class="stat-icon">
					<HardDrive size={18} />
				</div>
				<div class="stat-content">
					<span class="stat-value">{$statsStore.storageUsed}</span>
					<span class="stat-label">Storage</span>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.stats-panel {
		height: fit-content;
		display: flex;
		flex-direction: column;
	}

	.panel-content {
		padding: 0;
	}

	.stats-grid {
		display: grid;
		gap: 0.625rem;
		grid-template-columns: 1fr;
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.875rem;
		background-color: #242424;
		border-radius: 8px;
		border: 1px solid #2a2a2a;
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background-color: #007aff;
		border-radius: 8px;
		color: #fff;
		flex-shrink: 0;
	}

	.stat-content {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.stat-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: #fff;
		line-height: 1.2;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #999;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}
</style>