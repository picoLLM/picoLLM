<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import FilterCondition from './FilterCondition.svelte';
	import { QdrantService } from '$lib/api/qdrant';
	import { filterStore } from '$lib/stores/filters';
	import { FilterActions } from '$lib/features/filters/filter';
	import type { QdrantSchemaProperty } from '$lib/types/qdrant';
  
	export let selectedCollection: string;
	export let disabled = false;
  
	let collectionSchema: Record<string, QdrantSchemaProperty> | null = null;
	const qdrantService = new QdrantService();
	const dispatch = createEventDispatcher();
  
	$: if (selectedCollection) {
	  fetchCollectionInfo();
	}
  
	async function fetchCollectionInfo() {
	  try {
		const schema = await qdrantService.getCollectionSchema(selectedCollection);
		if (schema) {
		  collectionSchema = schema;
		}
	  } catch (error) {
		console.error('Error fetching collection info:', error);
		collectionSchema = null;
	  }
	}
  
	function handleFilterChange() {
	  const filter = FilterActions.updateFilter($filterStore);
	  dispatch('updateFilter', { filter });
	}
  
	$: if ($filterStore) {
	  handleFilterChange();
	}
  </script>
  
  {#if collectionSchema}
	<div class="filter-builder">
	  {#each $filterStore as group, groupIndex}
		<div class="filter-group">
		  <div class="group-header">
			<div class="select-wrapper">
			  <select 
				bind:value={group.type} 
				on:change={() => filterStore.updateGroupType(groupIndex, group.type)}
				{disabled} 
				class="group-type-select"
			  >
				<option value="must">Must Match (AND)</option>
				<option value="should">Should Match (OR)</option>
				<option value="must_not">Must Not Match</option>
			  </select>
			</div>
  
			{#if $filterStore.length > 1}
			  <button 
				class="remove-group" 
				on:click={() => filterStore.removeGroup(groupIndex)} 
				{disabled}
			  >
				Remove Group
			  </button>
			{/if}
		  </div>
  
		  <div class="conditions-list">
			{#each group.conditions as condition, conditionIndex}
			  <FilterCondition
				{condition}
				schema={collectionSchema}
				on:remove={() => filterStore.removeCondition(groupIndex, conditionIndex)}
				on:change={() => {
				  handleFilterChange();
				  FilterActions.ensureEmptyCondition(groupIndex);
				}}
			  />
			{/each}
		  </div>
		</div>
	  {/each}
  
	  <button 
		class="add-group" 
		on:click={() => filterStore.addGroup()} 
		{disabled}
	  >
		+ Add Filter Group
	  </button>
	</div>
  {:else}
	<div class="loading">Loading collection schema...</div>
  {/if}
  
  
  <style>
	/* All styles remain exactly the same */
	.filter-builder {
	  padding: 0.5rem 0;
	  display: flex;
	  flex-direction: column;
	  gap: 1rem;
	}
  
	.filter-group {
	  border: 1px solid #4a4a4a;
	  padding: 1rem;
	  border-radius: 4px;
	  background: #2a2a2a;
	}
  
	.group-header {
	  display: flex;
	  justify-content: space-between;
	  align-items: center;
	  margin-bottom: 1rem;
	  gap: 1rem;
	}
  
	.select-wrapper {
	  flex: 1;
	}
  
	.group-type-select {
	  width: 100%;
	}
  
	.conditions-list {
	  display: flex;
	  flex-direction: column;
	  gap: 0.75rem;
	  margin-bottom: 1rem;
	}
  
	button {
	  background: #3a3a3a;
	  border: none;
	  color: white;
	  padding: 0.5rem 1rem;
	  border-radius: 4px;
	  cursor: pointer;
	  font-size: 0.9rem;
	}
  
	button:hover:not(:disabled) {
	  background: #4a4a4a;
	}
  
	button:disabled {
	  opacity: 0.6;
	  cursor: not-allowed;
	}
  
	select {
	  background: #2a2a2a;
	  color: white;
	  border: 1px solid #4a4a4a;
	  padding: 0.5rem;
	  border-radius: 4px;
	  width: 100%;
	}
  
	select:focus {
	  border-color: #007aff;
	  outline: none;
	}
  
	.loading {
	  padding: 1rem;
	  text-align: center;
	  color: #888;
	}
  
	.add-group {
	  align-self: flex-start;
	}
  
	.remove-group {
	  background: #ff4444;
	  min-width: 120px;
	}
  
	.remove-group:hover:not(:disabled) {
	  background: #ff6666;
	}
  
	.conditions-list {
	  display: flex;
	  flex-direction: column;
	  gap: 0.75rem;
	  margin-bottom: 1rem;
	}
  </style>