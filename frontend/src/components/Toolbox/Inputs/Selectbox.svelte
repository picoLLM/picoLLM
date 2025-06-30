<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { ChevronDown } from 'lucide-svelte';
  
    interface CollectionInfo {
      name: string;
      status?: 'green' | 'yellow' | 'grey' | 'red';
    }
  
    export let options: (string | CollectionInfo)[] = [];
    export let value: string = '';
    export let placeholder: string = 'Select a collection';
    export let disabled: boolean = false;
  
    let isOpen = false;
    let selectElement: HTMLDivElement;
  
    const dispatch = createEventDispatcher<{change: string}>();
  
    function toggleDropdown() {
      if (!disabled) {
        isOpen = !isOpen;
      }
    }
  
    function selectOption(option: string | CollectionInfo) {
      const optionValue = typeof option === 'string' ? option : option.name;
      value = optionValue;
      isOpen = false;
      dispatch('change', optionValue);
    }
  
    function handleClickOutside(event: MouseEvent) {
      if (selectElement && !selectElement.contains(event.target as Node)) {
        isOpen = false;
      }
    }
  
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleDropdown();
      } else if (event.key === 'Escape' && isOpen) {
        isOpen = false;
      }
    }
  
    function getStatusEmoji(status?: 'green' | 'yellow' | 'grey' | 'red') {
      switch (status) {
        case 'green': return '🟢';
        case 'yellow': return '🟡';
        case 'grey': return '⚫';
        case 'red': return '🔴';
        default: return '';
      }
    }
  
    $: if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  
    $: selectedOption = options.find(option => 
      typeof option === 'string' ? option === value : option.name === value
    ) as string | CollectionInfo | undefined;
</script>
  
<div class="custom-select" class:disabled bind:this={selectElement}>
  <button
    type="button"
    class="select-header"
    on:click={toggleDropdown}
    on:keydown={handleKeydown}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-label={value || placeholder}
  >
    {#if selectedOption && typeof selectedOption !== 'string' && selectedOption.status}
      <span class="status-emoji">{getStatusEmoji(selectedOption.status)}</span>
    {/if}
    <span class="selected-value">{value || placeholder}</span>
    <span class="chevron-wrapper" class:open={isOpen} aria-hidden="true">
      <ChevronDown size={18} />
    </span>
  </button>
  {#if isOpen}
    <ul class="options-list" role="listbox">
      {#each options as option (typeof option === 'string' ? option : option.name)}
        <li
          class="option"
          role="option"
          aria-selected={typeof option === 'string' ? option === value : option.name === value}
          tabindex="0"
          on:click={() => selectOption(option)}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectOption(option);
            }
          }}
        >
          {#if typeof option !== 'string' && option.status}
            <span class="status-emoji">{getStatusEmoji(option.status)}</span>
          {/if}
          {typeof option === 'string' ? option : option.name}
        </li>
      {/each}
    </ul>
  {/if}
</div>
  
<style>
  .custom-select {
    position: relative;
    width: 100%;
    font-size: 14px;
    color: #ffffff;
    margin-bottom: 1rem;
  }
  
  .disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  .select-header {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    background-color: #3a3a3a;
    border: 1px solid #4a4a4a;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  
  .select-header:hover, .select-header:focus {
    background-color: #444444;
    outline: none;
    border-color: #007aff;
  }
  
  .chevron-wrapper {
    margin-left: auto;
    transition: transform 0.2s ease;
  }
  
  .chevron-wrapper.open {
    transform: rotate(180deg);
  }
  
  .options-list {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
    background-color: #3a3a3a;
    border: 1px solid #4a4a4a;
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .status-emoji {
    margin-right: 8px;
    font-size: 1.2em;
  }

  .selected-value {
    flex-grow: 1;
  }
  
  .option {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .option:hover, .option:focus {
    background-color: #444444;
    outline: none;
  }
  
  .option[aria-selected="true"] {
    background-color: #007aff;
    font-weight: bold;
  }
  
  /* Custom scrollbar styles */
  .options-list::-webkit-scrollbar {
    width: 8px;
  }
  
  .options-list::-webkit-scrollbar-track {
    background: #2a2a2a;
  }
  
  .options-list::-webkit-scrollbar-thumb {
    background-color: #555;
    border-radius: 4px;
  }
  
  .options-list::-webkit-scrollbar-thumb:hover {
    background-color: #777;
  }
</style>