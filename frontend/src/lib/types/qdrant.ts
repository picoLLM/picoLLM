// *******************************
// Qdrant Types
// *******************************

export interface QdrantSchemaProperty {
	data_type: 'text' | 'integer' | 'keyword' | 'float' | 'geo' | 'bool' | 'datetime' | 'uuid';
	params?: Record<string, unknown>;
	points: number; // Made required
}

export interface QdrantPayloadSchema {
	payload_schema: Record<string, QdrantSchemaProperty>;
}

export interface QdrantCollectionInfo {
	name: string;
	status: 'green' | 'yellow' | 'grey' | 'red';
	payload_schema: Record<string, QdrantSchemaProperty>;
}

export interface QdrantCollectionResponse {
	payload_schema: {
		[key: string]: {
			data_type: 'text' | 'integer' | 'keyword' | 'float' | 'geo' | 'bool' | 'datetime' | 'uuid';
			params?: Record<string, unknown>;
			points: number;
		};
	};
}

export interface QdrantRangeValue {
	gte?: number | undefined;
	lte?: number | undefined;
}

export interface QdrantFilterCondition {
	key: string;
	operator: 'match' | 'match_any' | 'match_except' | 'range';
	value: QdrantRangeValue | string | number;
}

export interface QdrantFilterGroup {
	type: 'must' | 'should' | 'must_not';
	conditions: QdrantFilterCondition[];
}

export interface QdrantFilter {
	must?: Record<string, any>[];
	should?: Record<string, any>[];
	must_not?: Record<string, any>[];
}

export interface CollectionInfo {
	name: string;
	status: 'green' | 'yellow' | 'grey' | 'red';
}

export interface Field {
	name: string;
	data_type: string;
	params?: Record<string, unknown>;
	points: number;
}

export interface Operator {
	value: string;
	label: string;
}
