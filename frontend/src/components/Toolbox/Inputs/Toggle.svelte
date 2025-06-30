<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  
  export let label: string;
  export let checked: boolean = false;
  export let disabled: boolean = false;
  export let id: string = uuidv4();
  
  const dispatch = createEventDispatcher<{
    change: boolean;
  }>();
  
  function handleChange() {
    if (!disabled) {
      checked = !checked;
      dispatch('change', checked);
    }
  }
</script>

<div class="toggle-group" class:disabled>
  <label for={id}>
    <span class="toggle-label">{label}</span>
    <div class="toggle-switch">
      <input
        type="checkbox"
        {id}
        bind:checked
        on:change={handleChange}
        {disabled}
      />
      <span class="toggle-slider"></span>
    </div>
  </label>
</div>

<style>
  .toggle-group {
    margin-bottom: 1rem;
  }
  
  .toggle-group label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 0.5rem 0;
  }
  
  .toggle-group.disabled label {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .toggle-label {
    color: #e5e7eb;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    flex: 1;
    transition: color 0.2s ease;
  }
  
  .toggle-group:hover:not(.disabled) .toggle-label {
    color: #ffffff;
  }
  
  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    transition: background 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .toggle-slider:before {
    position: absolute;
    content: '';
    height: 18px;
    width: 18px;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    background: #ffffff;
    border-radius: 50%;
    transition: transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .toggle-group:hover:not(.disabled) .toggle-slider {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.12);
  }
  
  input:checked + .toggle-slider {
    background: #007aff;
    border-color: #007aff;
  }
  
  input:checked + .toggle-slider:before {
    transform: translateX(20px) translateY(-50%);
  }
  
  input:focus-visible + .toggle-slider {
    outline: 2px solid #007aff;
    outline-offset: 2px;
  }
  
  @media (max-width: 768px) {
    .toggle-label {
      font-size: 0.8125rem;
    }
    
    .toggle-group label {
      padding: 0.375rem 0;
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    .toggle-slider,
    .toggle-slider:before,
    .toggle-label {
      transition: none;
    }
  }
</style>