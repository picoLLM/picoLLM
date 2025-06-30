<!-- src/components/Badge.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
  
    export let href: string | null = null;
    export let dotColor = '#ff0000';
    export let borderColor = '#ccc';
    export let backgroundColor = '#fff';
    export let textColor = '#000';
    export let ariaLabel = '';
    export let className = '';
  
    const dispatch = createEventDispatcher();
  
    function handleClick(event: MouseEvent) {
      dispatch('click', event);
    }
  </script>
  
  <style>
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25em 0.75em;
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      background-color: var(--background-color);
      color: var(--text-color);
      text-decoration: none;
      font-size: 0.875em;
      cursor: pointer;
    }
    .dot {
      width: 0.5em;
      height: 0.5em;
      margin-right: 0.5em;
      background-color: var(--dot-color);
      border-radius: 50%;
      flex-shrink: 0;
    }
  </style>
  
  {#if href}
    <a
      {href}
      class="badge {className}"
      aria-label={ariaLabel}
      on:click={handleClick}
      style="--dot-color: {dotColor}; --border-color: {borderColor}; --background-color: {backgroundColor}; --text-color: {textColor};"
    >
      <span class="dot"></span>
      <slot>Badge</slot>
    </a>
  {:else}
    <button
      type="button"
      class="badge {className}"
      aria-label={ariaLabel}
      on:click={handleClick}
      style="--dot-color: {dotColor}; --border-color: {borderColor}; --background-color: {backgroundColor}; --text-color: {textColor};"
    >
      <span class="dot"></span>
      <slot>Badge</slot>
    </button>
  {/if}