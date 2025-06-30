// src/lib/actions/filterActions.ts
import { filterStore } from '$lib/stores/filters';
import { FilterService } from '$lib/features/filters/filter';
import type { QdrantFilterGroup } from '$lib/types/qdrant';



export class FilterActions {
  static ensureEmptyCondition(groupIndex: number): void {
    if (!filterStore.hasEmptyCondition(groupIndex)) {
      filterStore.addCondition(groupIndex);
    }
  }

  static updateFilter(groups: QdrantFilterGroup[]): Record<string, any> {
    return FilterService.createFilter(groups);
  }
}
