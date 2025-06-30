// src/lib/services/filterConditionService.ts
import type {
	QdrantSchemaProperty,
	QdrantFilterCondition,
	QdrantRangeValue,
	Field,
	Operator
} from '$lib/types/qdrant';

export class FilterConditionService {
	private static currentYear = new Date().getFullYear();

	static transformSchemaToFields(schema: Record<string, QdrantSchemaProperty>): Field[] {
		return Object.entries(schema).reduce<Field[]>(
			(acc, [key, value]) => [...acc, { name: key, ...value }],
			[]
		);
	}

	static getFieldType(
		condition: QdrantFilterCondition,
		schema: Record<string, QdrantSchemaProperty>
	): string | undefined {
		return condition.key ? schema[condition.key]?.data_type : undefined;
	}

	static isNumericField(fieldType: string | undefined): boolean {
		return ['integer', 'float'].includes(fieldType ?? '');
	}

	static isYearField(fieldName: string): boolean {
		return fieldName.toLowerCase().includes('year');
	}

	static getRangeValue(condition: QdrantFilterCondition): QdrantRangeValue {
		return condition.operator === 'range'
			? (condition.value as QdrantRangeValue)
			: { gte: undefined, lte: undefined };
	}

	static getOperators(fieldType: string | undefined, fieldName: string): Operator[] {
		if (this.isYearField(fieldName)) {
			return [
				{ value: 'range', label: 'Range' },
				{ value: 'match', label: 'Equals' }
			];
		}

		switch (fieldType) {
			case 'keyword':
				return [
					{ value: 'match', label: 'Equals' },
					{ value: 'match_any', label: 'Matches Any' },
					{ value: 'match_except', label: 'Does Not Match' }
				];
			case 'integer':
			case 'float':
				return [
					{ value: 'match', label: 'Equals' },
					{ value: 'range', label: 'Range' }
				];
			default:
				return [{ value: 'match', label: 'Equals' }];
		}
	}

	static createRangeValue(
		currentValue: QdrantRangeValue,
		type: keyof QdrantRangeValue,
		value: string
	): QdrantRangeValue {
		return {
			...currentValue,
			[type]: value ? Number(value) : undefined
		};
	}

	static createDefaultYearRange(): QdrantRangeValue {
		return {
			gte: 1950,
			lte: this.currentYear
		};
	}

	static getDefaultValueForField(fieldName: string, operator: string): any {
		if (this.isYearField(fieldName) && operator === 'range') {
			return this.createDefaultYearRange();
		}
		return '';
	}
}
