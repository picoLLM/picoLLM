// src/lib/stores/filterStore.ts
import { writable, get } from 'svelte/store';
import type { QdrantFilterGroup, QdrantFilterCondition } from '$lib/types/qdrant';

const DEFAULT_CONDITION: QdrantFilterCondition = { key: '', operator: 'match', value: '' };
const DEFAULT_GROUP: QdrantFilterGroup = { type: 'must', conditions: [DEFAULT_CONDITION] };

function createFilterStore() {
  const { subscribe, update } = writable<QdrantFilterGroup[]>([{ ...DEFAULT_GROUP }]);

  return {
    subscribe,
    
    addCondition: (groupIndex: number) => 
      update(groups => {
        groups[groupIndex].conditions.push({ ...DEFAULT_CONDITION });
        return groups;
      }),
    
    addGroup: () => 
      update(groups => [...groups, { ...DEFAULT_GROUP, conditions: [{ ...DEFAULT_CONDITION }] }]),
    
    removeCondition: (groupIndex: number, conditionIndex: number) => 
      update(groups => {
        groups[groupIndex].conditions.splice(conditionIndex, 1);
        return groups;
      }),
    
    removeGroup: (groupIndex: number) => 
      update(groups => {
        groups.splice(groupIndex, 1);
        return groups;
      }),
    
    updateGroupType: (groupIndex: number, type: 'must' | 'should' | 'must_not') => 
      update(groups => {
        groups[groupIndex].type = type;
        return groups;
      }),
    
    hasEmptyCondition: (groupIndex: number) => {
      const groups = get({ subscribe });
      const group = groups[groupIndex];
      return group?.conditions.some(c => !c.key || !c.value) ?? false;
    }
  };
}

export const filterStore = createFilterStore();