<script lang="ts">
    import { ChevronUp, ChevronDown } from 'lucide-svelte';
    
    export let title: string;
    export let isOpen: boolean = false;
    export let disabled: boolean = false;
    
    function toggleDropdown() {
      if (!disabled) {
        isOpen = !isOpen;
      }
    }
  </script>
  
  <div class="dropdown" class:disabled class:open={isOpen}>
    <button
      class="dropdown-toggle"
      on:click={toggleDropdown}
      aria-expanded={isOpen}
      aria-controls="dropdown-content"
      {disabled}
    >
      <span class="dropdown-title">{title}</span>
      <div class="dropdown-icon" class:rotate={isOpen}>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </button>
    
    {#if isOpen}
      <div 
        class="dropdown-content" 
        id="dropdown-content"
      >
        <div class="content-inner">
          <slot></slot>
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    .dropdown {
      --dropdown-primary: #007AFF;
      --dropdown-bg: rgba(255, 255, 255, 0.03);
      --dropdown-hover: rgba(255, 255, 255, 0.05);
      --dropdown-border: rgba(255, 255, 255, 0.08);
      --dropdown-text: #e5e7eb;
      --dropdown-text-dim: #9ca3af;
      
      margin-bottom: 1rem;
      border-radius: 8px;
      background: var(--dropdown-bg);
      border: 1px solid var(--dropdown-border);
      overflow: hidden;
    }
    
    .dropdown:hover:not(.disabled) {
      border-color: rgba(255, 255, 255, 0.12);
      background: var(--dropdown-hover);
    }
    
    .dropdown.open {
      background: var(--dropdown-hover);
      border-color: var(--dropdown-primary);
      box-shadow: 0 0 0 1px var(--dropdown-primary) inset,
                  0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .dropdown-toggle {
      width: 100%;
      padding: 0.875rem 1rem;
      background: none;
      border: none;
      color: var(--dropdown-text);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
      font-weight: 500;
      position: relative;
    }
    
    .dropdown-toggle:hover:not(:disabled) {
      color: #ffffff;
    }
    
    .dropdown-toggle:focus {
      outline: none;
    }
    
    .dropdown-toggle:focus-visible {
      outline: 2px solid var(--dropdown-primary);
      outline-offset: -2px;
      border-radius: 7px;
    }
    
    .dropdown-title {
      flex: 1;
      text-align: left;
      font-weight: 500;
      letter-spacing: -0.01em;
    }
    
    .dropdown-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--dropdown-text-dim);
      flex-shrink: 0;
    }
    
    .dropdown-icon.rotate {
      transform: rotate(180deg);
      background: var(--dropdown-primary);
      color: white;
    }
    
    .dropdown:hover:not(.disabled) .dropdown-icon:not(.rotate) {
      background: rgba(255, 255, 255, 0.08);
      color: var(--dropdown-text);
    }
    
    .dropdown-content {
      border-top: 1px solid var(--dropdown-border);
      background: rgba(0, 0, 0, 0.2);
    }
    
    .content-inner {
      padding: 1rem;
    }
    
    /* Disabled state */
    .dropdown.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .dropdown.disabled .dropdown-toggle {
      cursor: not-allowed;
    }
    
    .dropdown.disabled:hover {
      border-color: var(--dropdown-border);
      background: var(--dropdown-bg);
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .dropdown-toggle {
        padding: 0.75rem 0.875rem;
        font-size: 0.8125rem;
      }
      
      .content-inner {
        padding: 0.875rem;
      }
    }
  </style>