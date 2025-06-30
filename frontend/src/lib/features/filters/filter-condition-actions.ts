import type { QdrantFilterCondition, QdrantRangeValue } from '$lib/types/qdrant';
import { FilterConditionService } from '$lib/features/filters/filter-condition';

export class FilterConditionActions {
	static handleFieldChange(condition: QdrantFilterCondition): void {
		condition.operator = 'match';
		condition.value = FilterConditionService.getDefaultValueForField(
			condition.key,
			condition.operator
		);
	}

	static handleOperatorChange(condition: QdrantFilterCondition): void {
		condition.value = FilterConditionService.getDefaultValueForField(
			condition.key,
			condition.operator
		);
	}

	static handleRangeChange(
		condition: QdrantFilterCondition,
		type: keyof QdrantRangeValue,
		value: string
	): void {
		if (condition.operator === 'range') {
			const currentValue = FilterConditionService.getRangeValue(condition);
			condition.value = FilterConditionService.createRangeValue(currentValue, type, value);
		}
	}

	static handleSimpleValueChange(
		condition: QdrantFilterCondition,
		value: string,
		fieldType: string | undefined
	): void {
		condition.value = FilterConditionService.isNumericField(fieldType) ? Number(value) : value;
	}
}
