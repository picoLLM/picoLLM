<script lang="ts">
  import { ChevronUp, ChevronDown } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let title: string;
  export let isOpen: boolean = false;
  export let disabled: boolean = false;
  export let checked: boolean = false;
  export let toggleDisabled: boolean = false;
  
  const dispatch = createEventDispatcher<{
    toggle: boolean;
    toggleDropdown: boolean;
  }>();
  
  function handleToggle() {
    if (!toggleDisabled) {
      checked = !checked;
      dispatch('toggle', checked);
    }
  }
  
  function toggleDropdown() {
    if (!disabled) {
      isOpen = !isOpen;
      dispatch('toggleDropdown', isOpen);
    }
  }
  </script>
  
  <div class="hybrid-dropdown" class:disabled>
    <div class="hybrid-header">
      <div class="tool-item" class:disabled>
        <div class="tool-info">
          <span class="tool-label">{title}</span>
        </div>
        <label class="checkbox-container">
          <input
            type="checkbox"
            bind:checked
            on:change={handleToggle}
            disabled={toggleDisabled}
          />
          <span class="checkmark"></span>
        </label>
      </div>
      <button
        class="dropdown-toggle"
        on:click={toggleDropdown}
        aria-expanded={isOpen}
        aria-controls="dropdown-content"
        {disabled}
      >
        {#if isOpen}
          <ChevronUp size={20} aria-hidden="true" />
        {:else}
          <ChevronDown size={20} aria-hidden="true" />
        {/if}
      </button>
    </div>
    {#if isOpen}
      <div class="dropdown-content" id="dropdown-content">
        <slot></slot>
      </div>
    {/if}
  </div>
  
  <style>
    .hybrid-dropdown {
      margin-bottom: 1.5rem;
    }
  
    .hybrid-header {
      display: flex;
      align-items: center;
      border-bottom: 1px solid #4a4a4a;
      transition: border-color 0.3s ease;
    }
  
    .hybrid-header:hover {
      border-bottom-color: #007AFF;
    }
  
    .tool-item {
      background-color: transparent;
      flex-grow: 1;
      padding: 0.75rem 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  
    .tool-info {
      flex-grow: 1;
      margin-right: 16px;
    }
  
    .tool-label {
      color: #ffffff;
      font-size: 1rem;
    }
  
    .checkbox-container {
      position: relative;
      cursor: pointer;
      font-size: 22px;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
    }
  
    .checkbox-container input {
      position: absolute;
      opacity: 0;
      cursor: pointer;
      width: 0;
      height: 0;
    }
  
    .checkmark {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 25px;
      width: 25px;
      background-color: #2a2a2a;
      border: 2px solid #007AFF;
      border-radius: 5px;
      transition: all 0.3s ease;
    }
  
    .checkbox-container:hover input ~ .checkmark {
      background-color: #3a3a3a;
    }
  
    .checkbox-container input:checked ~ .checkmark {
      background-color: #007AFF;
    }
  
    .checkmark:after {
      content: "";
      position: absolute;
      display: none;
      width: 6px;
      height: 12px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
  
    .checkbox-container input:checked ~ .checkmark:after {
      display: block;
    }
  
    .dropdown-toggle {
      background: none;
      border: none;
      color: #ffffff;
      cursor: pointer;
      padding: 0.75rem;
    }
  
    .dropdown-content {
      padding-top: 1rem;
    }
  
    .hybrid-dropdown.disabled {
      opacity: 0.6;
      pointer-events: none;
    }
  
    input:disabled ~ .checkmark {
      opacity: 0.6;
      cursor: not-allowed;
    }
  </style>