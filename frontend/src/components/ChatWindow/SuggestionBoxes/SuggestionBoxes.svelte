<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { settingsStore } from '$lib/stores/settings';
  import { selectedProvider } from '$lib/stores/model-selector';
  import {
    getProviderLabel,
    determineModelCapabilities,
    getCapabilityIcon,
    getSuggestions,
    Icons
  } from '$lib/features/suggestions/suggestion-boxes';

  const dispatch = createEventDispatcher<{ selectSuggestion: string }>();

  let currentModel = '';
  let currentProvider = '';
  let providerIcon = '';
  let modelCapabilities: string[] = [];

  const unsubscribeSettings = settingsStore.subscribe((settings) => {
    currentModel = settings.model;
    currentProvider = getProviderLabel(settings.provider);
    modelCapabilities = determineModelCapabilities(settings.model, settings.provider).slice(0, 3);
  });

  const unsubscribeProvider = selectedProvider.subscribe((provider) => {
    if (provider) {
      currentProvider = provider.label;
      providerIcon = provider.icon;
    }
  });

  // Get fixed suggestions from the .ts file
  const suggestions = getSuggestions();

  function handleSuggestionClick(suggestion: string) {
    dispatch('selectSuggestion', suggestion);
  }

  onDestroy(() => {
    unsubscribeSettings();
    unsubscribeProvider();
  });
</script>

<div class="suggestions-container">
  <div class="model-info">
    <div class="model-header">
      <div class="model-provider">
        {#if providerIcon}
          <img src={providerIcon} alt={currentProvider} class="provider-icon" />
        {:else}
          <svelte:component this={Icons.Zap} size={16} class="provider-icon-default" />
        {/if}
        <span class="provider-name">{currentProvider}</span>
        <svelte:component this={Icons.Shield} size={14} class="verified-icon" />
      </div>
      <div class="model-name">{currentModel || '\u00A0'}</div>
    </div>
    <div class="model-capabilities">
      {#if modelCapabilities.length > 0}
        {#each modelCapabilities as capability}
          <span class="capability-tag">
            <svelte:component
              this={getCapabilityIcon(capability)}
              size={12}
              class="capability-icon"
            />
            <span class="capability-text">{capability}</span>
          </span>
        {/each}
      {:else}
        <span class="capability-placeholder">&nbsp;</span>
      {/if}
    </div>
  </div>

  <div class="suggestions-section">
    <div class="suggestions-header">
      <svelte:component this={Icons.Sparkles} size={16} class="sparkles-icon" />
      <span>Try asking about:</span>
    </div>
    <div class="suggestion-boxes">
      {#each suggestions as suggestion}
        <button
          class="suggestion-box"
          on:click={() => handleSuggestionClick(suggestion.text)}
          style="--icon-color: {suggestion.color}"
          type="button"
        >
          <div class="icon-wrapper">
            <svelte:component this={suggestion.icon} size={18} />
          </div>
          <span class="suggestion-text">{suggestion.text}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  @import '../../../lib/styles/components/ChatWindow/suggestion-boxes.css';
</style>