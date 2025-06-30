<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Wrench, CircleDot } from 'lucide-svelte';
	import { settingsStore } from '$lib/stores/settings';
	import SearchBar from './ModelSelector/ModelSelector.svelte';
	import type { ProviderEnum } from '$lib/types/global';
	
	const dispatch = createEventDispatcher();
	
	function toggleSettings() {
	  dispatch('toggleSettings');
	}
	
	function handleProviderChange(event: CustomEvent<{ provider: ProviderEnum; baseUrl: string }>) {
	  const { provider, baseUrl } = event.detail;
	  settingsStore.setProvider(provider);
	  settingsStore.setBaseUrl(baseUrl);
	}
	
	$: modelStatus = $settingsStore.model ? 'active' : 'inactive';
  </script>
  
  <div class="top-bar">
	<div class="left-section">
	  <SearchBar placeholder="Enter model name" on:providerChange={handleProviderChange} />
	</div>
	<div class="actions">
	  <div class="model-status {modelStatus}" aria-label={`Model status: ${modelStatus}`}>
		<CircleDot size={16} />
	  </div>
	  <button class="icon-button" on:click={toggleSettings} aria-label="Toggle settings">
		<Wrench size={16} />
	  </button>
	</div>
  </div>
  
  <style>
	@import '../../lib/styles/components/TopBar/top-bar.css';
  </style>