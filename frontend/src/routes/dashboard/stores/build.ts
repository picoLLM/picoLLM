// src/routes/configure/stores/build.store.ts
import { writable } from 'svelte/store';
import type { BuildProgress } from '$lib/types/configure';

interface BuildState {
	isBuilding: boolean;
	progress: BuildProgress | null;
	error: string | null;
}

function createBuildStore() {
	const { subscribe, set, update } = writable<BuildState>({
		isBuilding: false,
		progress: null,
		error: null
	});

	return {
		subscribe,
		setBuilding: (isBuilding: boolean) => update(state => ({ ...state, isBuilding })),
		setProgress: (progress: BuildProgress) => update(state => ({ ...state, progress })),
		setError: (error: string | null) => update(state => ({ ...state, error })),
		reset: () => set({ isBuilding: false, progress: null, error: null })
	};
}

export const buildStore = createBuildStore();