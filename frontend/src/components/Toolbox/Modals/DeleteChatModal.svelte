<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Modal from './BaseModal.svelte';
  
    export let isOpen = false;
    export let chatName = '';
  
    const dispatch = createEventDispatcher();
  
    function handleConfirm() {
      dispatch('confirm');
      close();
    }
  
    function close() {
      dispatch('close');
    }
  </script>
  
  <Modal {isOpen} title="Delete Chat" on:close={close}>
    <p id="delete-description">Are you sure you want to delete the chat "{chatName}"? This action cannot be undone.</p>
    <div class="button-group">
      <button type="button" class="cancel" on:click={close}>Cancel</button>
      <button 
        type="button" 
        class="delete" 
        on:click={handleConfirm}
        aria-describedby="delete-description"
      >
        Delete
      </button>
    </div>
  </Modal>
  
  <style>
    p {
      margin-bottom: 1.5rem;
      color: #ffffff;
    }
  
    .button-group {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  
    button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
  
    .cancel {
      background-color: #444;
      color: #ffffff;
    }
  
    .delete {
      background-color: #dc3545;
      color: #ffffff;
    }
  
    .delete:hover {
      background-color: #c82333;
    }
  </style>