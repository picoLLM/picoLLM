// src/routes/configure/stores/search.store.ts
import { writable, derived } from 'svelte/store';
import { qdrantService, type SearchResult } from '$lib/api/qdrant';

interface SearchParams {
	collection: string;
	query: string;
	topK: number;
}

interface SearchState {
	isSearching: boolean;
	results: SearchResult[];
	hasSearched: boolean;
	lastSearchParams: SearchParams | null;
}

function createSearchStore() {
	const { subscribe, set, update } = writable<SearchState>({
		isSearching: false,
		results: [],
		hasSearched: false,
		lastSearchParams: null
	});

	async function search(params: SearchParams) {
		update(state => ({ 
			...state, 
			isSearching: true,
			lastSearchParams: params 
		}));
		
		try {
			const results = await qdrantService.simpleSearch(
				params.collection,
				params.query,
				params.topK
			);
			
			set({
				isSearching: false,
				results,
				hasSearched: true,
				lastSearchParams: params
			});
		} catch (error) {
			console.error('Search failed:', error);
			set({
				isSearching: false,
				results: [],
				hasSearched: true,
				lastSearchParams: params
			});
		}
	}

	function reset() {
		set({ 
			isSearching: false, 
			results: [], 
			hasSearched: false,
			lastSearchParams: null 
		});
	}

	return {
		subscribe,
		search,
		reset
	};
}

export const searchStore = createSearchStore();

// Derived store for easy access to search result IDs
// Assumes ID is stored in metadata.id or metadata._id
export const searchResultIds = derived(
	searchStore,
	$searchStore => {
		return $searchStore.results.map((r, idx) => {
			// Try common ID field names in metadata
			if (r.metadata?.id) return r.metadata.id;
			if (r.metadata?._id) return r.metadata._id;
			if (r.metadata?.document_id) return r.metadata.document_id;
			// Fallback to index-based ID if no ID found
			return `search-result-${idx}`;
		});
	}
);

// Derived store for current collection being searched
export const currentSearchCollection = derived(
	searchStore,
	$searchStore => $searchStore.lastSearchParams?.collection || null
);

// Derived store for search results with extracted IDs
export const searchResultsWithIds = derived(
	searchStore,
	$searchStore => {
		return $searchStore.results.map((r, idx) => ({
			...r,
			id: r.metadata?.id || r.metadata?._id || r.metadata?.document_id || `search-result-${idx}`
		}));
	}
);