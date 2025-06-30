// src/routes/configure/stores/stats.store.ts
import { writable } from 'svelte/store';
import { qdrantService } from '$lib/api/qdrant';

interface CollectionInfo {
	name: string;
	pointsCount?: number;
	vectorsCount?: number;
	status?: string;
}

interface StatsState {
	totalCollections: number;
	totalPoints: number;
	storageUsed: string;
	collections: CollectionInfo[];
}

function createStatsStore() {
	const { subscribe, set } = writable<StatsState>({
		totalCollections: 0,
		totalPoints: 0,
		storageUsed: '0 GB',
		collections: []
	});

	async function loadStats() {
		try {
			const dbStats = await qdrantService.getDatabaseStats();
			
			// Estimate storage (rough calculation: ~100KB per point)
			const storageGB = (dbStats.totalPoints * 0.0001).toFixed(1);
			
			const collections: CollectionInfo[] = dbStats.collections
				? dbStats.collections
					.filter((col): col is NonNullable<typeof col> => col !== null)
					.map(col => ({
						name: col.name,
						pointsCount: col.pointsCount ?? undefined,
						vectorsCount: col.vectorsCount ?? undefined,
						status: col.status?.toString()
					}))
				: [];
			
			set({
				totalCollections: dbStats.totalCollections,
				totalPoints: dbStats.totalPoints,
				storageUsed: `${storageGB} GB`,
				collections
			});
		} catch (error) {
			console.error('Failed to load stats:', error);
		}
	}

	return {
		subscribe,
		loadStats
	};
}

export const statsStore = createStatsStore();