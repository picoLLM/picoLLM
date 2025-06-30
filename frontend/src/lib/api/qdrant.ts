// src/lib/services/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import type { QdrantSchemaProperty } from '$lib/types/qdrant';
import { BACKEND_URL } from '$lib/constants/global.constants';
import { QDRANT_URI } from '$lib/constants/global.constants';
import type { CollectionInfo } from '$lib/types/qdrant';

export interface SearchFilter {
	must?: Record<string, any>[];
	should?: Record<string, any>[];
	must_not?: Record<string, any>[];
}

export interface SearchRequest {
	collection_name: string;
	query: string;
	filters?: SearchFilter;
	top_k?: number;
}

export interface SearchResult {
	content: string;
	metadata: Record<string, any>;
	score: number;
}

export interface SearchResponse {
	results: SearchResult[];
}


export async function fetchCollectionList(): Promise<CollectionInfo[]> {
    try {
        const response = await fetch(`${QDRANT_URI}/collections`);
        const data = await response.json();
        const collectionNames = data.result.collections.map((c: { name: string }) => c.name);

        return await Promise.all(
            collectionNames.map(async (name: string) => {
                const statusResponse = await fetch(`${QDRANT_URI}/collections/${name}`);
                const statusData = await statusResponse.json();
                return {
                    name,
                    status: statusData.result?.status || 'grey'
                };
            })
        );
    } catch (error) {
        console.error('Error fetching collections:', error);
        return [];
    }
}

export class QdrantService {
	private client: QdrantClient;

	constructor() {
		// Always use QDRANT_URL for Qdrant operations
		this.client = new QdrantClient({ url: QDRANT_URI });
	}

	async getCollectionSchema(collectionName: string): Promise<Record<string, QdrantSchemaProperty> | null> {
		try {
			const response = await this.client.getCollection(collectionName);
			console.log('Collection response:', response);
			
			if (response?.payload_schema) {
				const convertedSchema: Record<string, QdrantSchemaProperty> = {};
				Object.entries(response.payload_schema).forEach(([key, value]) => {
					if (value) {
						convertedSchema[key] = {
							data_type: value.data_type,
							params: value.params || {},
							points: value.points
						};
					}
				});
				return convertedSchema;
			}
			return null;
		} catch (error) {
			console.error('Error fetching collection info:', error);
			return null;
		}
	}

	async search(request: SearchRequest): Promise<SearchResponse> {
		try {
			const response = await fetch(`${BACKEND_URL}/collections/search`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					collection_name: request.collection_name,
					query: request.query,
					filters: request.filters,
					top_k: request.top_k || 10
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.detail || 'Search request failed');
			}

			const data: SearchResponse = await response.json();
			return data;
		} catch (error) {
			console.error('Error performing search:', error);
			throw error;
		}
	}

	// Helper method to build filters
	buildFilters(conditions: {
		must?: Array<{field: string, value: any}>;
		should?: Array<{field: string, value: any}>;
		must_not?: Array<{field: string, value: any}>;
	}): SearchFilter {
		const filter: SearchFilter = {};

		if (conditions.must) {
			filter.must = conditions.must.map(({ field, value }) => ({ [field]: value }));
		}

		if (conditions.should) {
			filter.should = conditions.should.map(({ field, value }) => ({ [field]: value }));
		}

		if (conditions.must_not) {
			filter.must_not = conditions.must_not.map(({ field, value }) => ({ [field]: value }));
		}

		return filter;
	}

	// Convenience method for simple searches
	async simpleSearch(collectionName: string, query: string, topK: number = 10): Promise<SearchResult[]> {
		const response = await this.search({
			collection_name: collectionName,
			query,
			top_k: topK
		});
		return response.results;
	}

	// Get all collections
	async getCollections(): Promise<string[]> {
		try {
			const response = await this.client.getCollections();
			return response.collections.map(col => col.name);
		} catch (error) {
			console.error('Error fetching collections:', error);
			return [];
		}
	}

	// Get collection info including point count
	async getCollectionInfo(collectionName: string) {
		try {
			const collection = await this.client.getCollection(collectionName);
			return {
				name: collectionName,
				pointsCount: collection.points_count,
				vectorsCount: collection.vectors_count,
				segmentsCount: collection.segments_count,
				status: collection.status
			};
		} catch (error) {
			console.error('Error fetching collection info:', error);
			return null;
		}
	}

	// Get database stats
	async getDatabaseStats() {
		try {
			const collections = await this.getCollections();
			const stats = await Promise.all(
				collections.map(name => this.getCollectionInfo(name))
			);

			const totalPoints = stats.reduce((sum, col) => sum + (col?.pointsCount || 0), 0);
			
			return {
				totalCollections: collections.length,
				totalPoints,
				collections: stats.filter(Boolean)
			};
		} catch (error) {
			console.error('Error fetching database stats:', error);
			return {
				totalCollections: 0,
				totalPoints: 0,
				collections: []
			};
		}
	}
}

// Export singleton instance
export const qdrantService = new QdrantService();