<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { X } from 'lucide-svelte';
  
    export let isOpen = false;
    export let title = '';
  
    const dispatch = createEventDispatcher();
    let modalContent: HTMLDivElement;
    let closeButton: HTMLButtonElement;
  
    function close() {
      dispatch('close');
    }
  
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }
  
    onMount(() => {
      if (isOpen && closeButton) {
        closeButton.focus();
      }
    });
  
    $: if (isOpen && closeButton) {
      setTimeout(() => closeButton.focus(), 0);
    }
  </script>
  
  <svelte:window on:keydown={handleKeydown} />
  
  {#if isOpen}
    <div class="modal-wrapper">
      <div 
        class="modal-overlay"
        aria-hidden="true"
      ></div>
      <div 
        class="modal-content" 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        bind:this={modalContent}
      >
        <div class="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button 
            class="close-button" 
            on:click={close} 
            aria-label="Close modal"
            bind:this={closeButton}
          >
            <X size={24} />
          </button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
      </div>
    </div>
  {/if}
  
  <style>
    .modal-wrapper {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
  
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
    }
  
    .modal-content {
      background-color: #1e1e1e;
      border-radius: 8px;
      padding: 1.5rem;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1001;
    }
  
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
  
    .modal-header h2 {
      color: #ffffff;
      margin: 0;
      font-size: 1.5rem;
    }
  
    .close-button {
      background: none;
      border: none;
      color: #a0a0a0;
      cursor: pointer;
      padding: 0;
    }
  
    .close-button:hover {
      color: #ffffff;
    }
  
    .modal-body {
      color: #a0a0a0;
    }
  </style>