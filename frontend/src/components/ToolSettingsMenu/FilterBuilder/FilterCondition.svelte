<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { FilterConditionService } from '$lib/features/filters/filter-condition';
  import { FilterConditionActions } from '$lib/features/filters/filter-condition-actions';
  import type { 
    QdrantSchemaProperty,
    QdrantFilterCondition,
  } from '$lib/types/qdrant';
  
  export let condition: QdrantFilterCondition;
  export let schema: Record<string, QdrantSchemaProperty>;

  // Add unique IDs for form controls
  const fieldId = `field-${crypto.randomUUID()}`;
  const operatorId = `operator-${crypto.randomUUID()}`;
  const valueId = `value-${crypto.randomUUID()}`;
  const fromId = `from-${crypto.randomUUID()}`;
  const toId = `to-${crypto.randomUUID()}`;
  
  const dispatch = createEventDispatcher();

  // Reactive declarations using service methods
  $: fields = FilterConditionService.transformSchemaToFields(schema);
  $: fieldType = FilterConditionService.getFieldType(condition, schema);
  $: isNumericField = FilterConditionService.isNumericField(fieldType);
  $: rangeValue = FilterConditionService.getRangeValue(condition);
  $: operators = FilterConditionService.getOperators(fieldType, condition.key);
  $: gteValue = rangeValue.gte ?? '';
  $: lteValue = rangeValue.lte ?? '';
  
  // Event handlers
  function handleFieldChange(): void {
    FilterConditionActions.handleFieldChange(condition);
    notifyChange();
  }

  function handleOperatorChange(): void {
    FilterConditionActions.handleOperatorChange(condition);
    notifyChange();
  }

  function handleRangeChange(type: 'gte' | 'lte', value: string): void {
    FilterConditionActions.handleRangeChange(condition, type, value);
    notifyChange();
  }

  function handleSimpleValueChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    FilterConditionActions.handleSimpleValueChange(condition, value, fieldType);
    notifyChange();
  }

  function notifyChange(): void {
    dispatch('change');
  }

  function handleRemove(): void {
    dispatch('remove');
  }
</script>

<div class="filter-condition">
  <div class="condition-content">
    <!-- Field Selection with associated label -->
    <div class="field-section">
      <label for={fieldId}>Field</label>
      <select 
        id={fieldId}
        bind:value={condition.key}
        on:change={handleFieldChange}
        class="field-select"
      >
        <option value="">Select field</option>
        {#each fields as field}
          <option value={field.name}>
            {field.name} ({field.data_type})
          </option>
        {/each}
      </select>
    </div>

    {#if condition.key}
      <!-- Operator Selection with associated label -->
      <div class="operator-section">
        <label for={operatorId}>Operator</label>
        <select 
          id={operatorId}
          bind:value={condition.operator}
          on:change={handleOperatorChange}
          class="operator-select"
        >
          {#each operators as op}
            <option value={op.value}>{op.label}</option>
          {/each}
        </select>
      </div>

      <!-- Value Input with associated label -->
      <div class="value-section">
        <label for={condition.operator === 'range' ? fromId : valueId}>
          {condition.operator === 'range' ? 'Range' : 'Value'}
        </label>
        {#if condition.operator === 'range'}
          <div class="range-inputs">
            <div class="range-field">
              <label for={fromId} class="range-label">From</label>
              <input
                id={fromId}
                type="number"
                class="range-input"
                placeholder="Min value"
                value={gteValue}
                on:input={(e) => handleRangeChange('gte', e.currentTarget.value)}
              />
            </div>
            <div class="range-field">
              <label for={toId} class="range-label">To</label>
              <input
                id={toId}
                type="number"
                class="range-input"
                placeholder="Max value"
                value={lteValue}
                on:input={(e) => handleRangeChange('lte', e.currentTarget.value)}
              />
            </div>
          </div>
        {:else}
          <input
            id={valueId}
            type={isNumericField ? 'number' : 'text'}
            class="value-input"
            placeholder="Enter value"
            value={condition.value}
            on:input={handleSimpleValueChange}
          />
        {/if}
      </div>
    {/if}
  </div>

  <button 
    class="remove" 
    on:click={handleRemove} 
    title="Remove condition"
    aria-label="Remove condition"
  >
    ×
  </button>
</div>

<style>
  .filter-condition {
    display: flex;
    gap: 0.75rem;
    width: 100%;
    background: #2a2a2a;
    border: 1px solid #3a3a3a;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }

  .condition-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .field-section,
  .operator-section,
  .value-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #888;
    padding-left: 0.25rem;
  }

  select, input {
    background: #232323;
    color: white;
    border: 1px solid #3a3a3a;
    padding: 0.5rem;
    border-radius: 4px;
    height: 36px;
    font-size: 0.9rem;
    width: 100%;
  }

  select:hover, input:hover {
    border-color: #4a4a4a;
  }

  select:focus, input:focus {
    border-color: #007aff;
    outline: none;
    background: #2a2a2a;
  }

  .range-inputs {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .range-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .range-label {
    font-size: 0.75rem;
    color: #666;
    padding-left: 0.25rem;
    font-weight: normal;
  }

  .range-input {
    width: 100%;
  }

  .remove {
    background: #ff4444;
    color: white;
    border: none;
    width: 24px;
    height: 24px;
    min-width: 24px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
    margin-top: 24px;
    transition: all 0.2s ease;
  }

  .remove:hover {
    background: #ff6666;
    transform: scale(1.1);
  }

  .filter-condition:hover {
    border-color: #4a4a4a;
  }

  .condition-content {
    transition: all 0.2s ease;
  }

  ::placeholder {
    color: #666;
  }

  select {
    text-overflow: ellipsis;
  }
</style>