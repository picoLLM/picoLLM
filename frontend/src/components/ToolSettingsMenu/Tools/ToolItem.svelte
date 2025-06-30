<script lang="ts">
  import Modal from '$components/Toolbox/Modals/BaseModal.svelte';
  import { deleteTool } from '$lib/api/tools';
  
  export let tool: { name: string; description: string };
  export let checked: boolean;
  export let disabled: boolean;
  export let onChange: (toolName: string) => void;
  export let onDelete: ((toolName: string) => void) | undefined = undefined;
  
  let isDeleting = false;
  let showDeleteModal = false;
  
  function formatName(name: string): string {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  async function confirmDelete() {
    isDeleting = true;
    showDeleteModal = false;
    
    try {
      await deleteTool(tool.name);
      
      // Notify parent component to refresh the tools list
      if (onDelete) {
        onDelete(tool.name);
      }
    } catch (error) {
      console.error('Failed to delete tool:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete tool';
      alert(`Failed to delete tool: ${errorMessage}`);
    } finally {
      isDeleting = false;
    }
  }
  
  console.log('ToolItem received:', { tool, checked, disabled });
</script>

<div class="tool-item" class:disabled>
  <button 
    class="delete-button"
    on:click={() => showDeleteModal = true}
    disabled={isDeleting}
    title="Delete tool"
    aria-label="Delete {formatName(tool.name)}"
  >
    ×
  </button>
  
  <div class="tool-info">
    <span class="tool-label">{formatName(tool.name)}</span>
    <span class="tool-description">{tool.description}</span>
  </div>
  
  <label class="checkbox-container" for={tool.name}>
    <input
      type="checkbox"
      id={tool.name}
      {checked}
      on:change={() => onChange(tool.name)}
      {disabled}
    />
    <span class="checkmark"></span>
  </label>
</div>

<Modal 
  isOpen={showDeleteModal} 
  title="Delete Tool"
  on:close={() => showDeleteModal = false}
>
  <div class="delete-modal-content">
    <p>Are you sure you want to delete <strong>{formatName(tool.name)}</strong>?</p>
    <p class="warning">This action cannot be undone.</p>
    
    <div class="modal-actions">
      <button 
        class="cancel-button" 
        on:click={() => showDeleteModal = false}
      >
        Cancel
      </button>
      <button 
        class="confirm-delete-button" 
        on:click={confirmDelete}
        disabled={isDeleting}
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  </div>
</Modal>


<style>
	@import '../../../lib/styles/components/ToolSettingsMenu/tool-item.css';
</style>
