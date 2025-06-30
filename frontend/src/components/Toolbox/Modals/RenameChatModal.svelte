<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import Modal from './BaseModal.svelte';
  
    export let isOpen = false;
    export let currentName = '';
  
    let newName = currentName;
    const dispatch = createEventDispatcher();
  
    function handleSubmit() {
      dispatch('rename', newName);
      close();
    }
  
    function close() {
      dispatch('close');
      newName = currentName;
    }
  </script>
  
  <Modal {isOpen} title="Rename Chat" on:close={close}>
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="newName">New Name:</label>
        <input
          type="text"
          id="newName"
          bind:value={newName}
          placeholder="Enter new chat name"
          aria-required="true"
        />
      </div>
      <div class="button-group">
        <button type="button" class="btn cancel" on:click={close}>Cancel</button>
        <button type="submit" class="btn confirm">Rename</button>
      </div>
    </form>
  </Modal>
  
  <style>
    .form-group {
      margin-bottom: 1.5rem;
    }
  
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #ffffff;
      font-size: 0.9rem;
    }
  
    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #444;
      border-radius: 4px;
      background-color: #2a2a2a;
      color: #ffffff;
      font-size: 1rem;
    }
  
    .button-group {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
    }
  
    .btn {
      padding: 0.75rem 1.5rem;
      border: 2px solid;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 0.9rem;
      transition: all 0.3s ease;
      background-color: transparent;
    }
  
    .cancel {
      color: #ffffff;
      border-color: #444;
    }
  
    .cancel:hover {
      background-color: rgba(68, 68, 68, 0.2);
    }
  
    .confirm {
      color: #007bff;
      border-color: #007bff;
    }
  
    .confirm:hover {
      background-color: rgba(0, 123, 255, 0.1);
    }
  </style>