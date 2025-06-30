<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let label: string;
  export let value: string | number = '';
  export let inputType: "text" | "number" | "textarea" = "text";
  export let placeholder: string = '';
  export let rows: number = 1;
  export let disabled: boolean = false;
  export let maxlength: number | undefined = undefined;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  
  const id = label.toLowerCase().replace(/\s+/g, '-');
  let focused = false;
  
  // Create event dispatcher to forward events to parent
  const dispatch = createEventDispatcher();
  
  function handleFocus() {
    focused = true;
  }
  
  function handleBlur() {
    focused = false;
  }
  
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    let newValue: string | number;
    
    if (inputType === 'number') {
      newValue = target.value === '' ? '' : Number(target.value);
    } else {
      newValue = target.value;
    }
    
    // Update local value
    value = newValue;
    
    // Forward the event to parent with the new value
    dispatch('input', newValue);
  }
</script>

<div class="styled-input-container" class:filled={value !== '' && value != null} class:focused>
  <label for={id}>{label}</label>
  {#if inputType === "textarea" || rows > 1}
    <textarea
      {id}
      value={value}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      {placeholder}
      {rows}
      {disabled}
      {maxlength}
    ></textarea>
  {:else if inputType === "number"}
    <input
      type="number"
      {id}
      value={value}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      {placeholder}
      {disabled}
      {maxlength}
      {min}
      {max}
    />
  {:else}
    <input
      type="text"
      {id}
      value={value}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      {placeholder}
      {disabled}
      {maxlength}
    />
  {/if}
</div>

<style>
  .styled-input-container {
    position: relative;
    margin-bottom: 1.5rem;
  }
  
  label {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    padding: 0 0.3rem;
    color: #a0a0a0;
    font-size: 1rem;
    transition: all 0.3s ease;
    pointer-events: none;
    background-color: transparent;
    z-index: 1;
  }
  
  .styled-input-container.focused label,
  .styled-input-container.filled label {
    top: -0.7rem;
    left: 0.5rem;
    font-size: 0.75rem;
    background-color: #2a2a2a;
    transform: translateY(0);
  }
  
  input, textarea {
    width: 100%;
    padding: 0.75rem;
    background-color: #2a2a2a;
    border: 1px solid #4a4a4a;
    color: #ffffff;
    border-radius: 4px;
    font-size: 1rem;
    transition: border-color 0.3s ease;
  }
  
  textarea {
    resize: vertical;
    min-height: 100px;
  }
  
  input:focus, textarea:focus {
    outline: none;
    border-color: #007AFF;
  }
  
  input:disabled, textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  input::placeholder, textarea::placeholder {
    color: transparent;
    transition: color 0.3s ease;
  }
  
  .styled-input-container.focused input::placeholder,
  .styled-input-container.focused textarea::placeholder,
  .styled-input-container.filled input::placeholder,
  .styled-input-container.filled textarea::placeholder {
    color: #6a6a6a;
  }
  
  /* Remove number input spinners */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>