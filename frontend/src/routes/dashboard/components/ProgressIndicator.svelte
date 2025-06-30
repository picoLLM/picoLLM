<script lang="ts">
  import { CheckCircle, AlertCircle, Loader2, Database } from 'lucide-svelte';
  import type { BuildProgress } from '$lib/types/configure';
  
  export let progress: BuildProgress;
  
  function getIcon(status: string) {
    switch (status) {
      case 'completed':
      case 'completed_dataset':
        return CheckCircle;
      case 'error':
        return AlertCircle;
      case 'creating':
      case 'loading':
        return Database;
      default:
        return Loader2;
    }
  }
  
  $: icon = getIcon(progress.status);
  $: percentage = progress.current && progress.total 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;
  $: isSpinning = progress.status === 'processing' || progress.status === 'inserting';
</script>

<div class="progress-container" class:error={progress.status === 'error'}>
  <div class="progress-header">
    <div class="progress-icon" class:spinning={isSpinning}>
      <svelte:component this={icon} size={14} />
    </div>
    <span class="progress-status">{progress.status}</span>
    {#if percentage > 0}
      <span class="progress-percentage">{percentage}%</span>
    {/if}
  </div>
  
  <div class="progress-message">
    {progress.message}
  </div>
  
  {#if progress.current && progress.total}
    <div class="progress-bar">
      <div class="progress-fill" style="width: {percentage}%"></div>
    </div>
    <div class="progress-details">
      {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
      {#if progress.dataset && progress.total_datasets}
        • Dataset {progress.dataset}/{progress.total_datasets}
      {/if}
    </div>
  {/if}
  
  {#if progress.total_processed}
    <div class="progress-summary">
      Total processed: {progress.total_processed.toLocaleString()} documents
    </div>
  {/if}
</div>

<style>
  .progress-container {
    background-color: #1e1e1e;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 0.875rem;
    margin-bottom: 1rem;
    font-size: 0.813rem;
  }
  
  .progress-container.error {
    border-color: #dc2626;
    background-color: rgba(220, 38, 38, 0.05);
  }
  
  .progress-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .progress-icon {
    color: #007aff;
    display: flex;
    align-items: center;
  }
  
  .progress-icon.spinning {
    animation: spin 1s linear infinite;
  }
  
  .error .progress-icon {
    color: #ef4444;
  }
  
  .progress-status {
    color: #999;
    text-transform: capitalize;
    font-weight: 500;
  }
  
  .progress-percentage {
    margin-left: auto;
    color: #007aff;
    font-weight: 600;
  }
  
  .progress-message {
    color: #ccc;
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }
  
  .progress-bar {
    height: 4px;
    background-color: #2a2a2a;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }
  
  .progress-fill {
    height: 100%;
    background-color: #007aff;
    transition: width 0.3s ease;
    border-radius: 2px;
  }
  
  .progress-details {
    color: #666;
    font-size: 0.75rem;
  }
  
  .progress-summary {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #2a2a2a;
    color: #999;
    font-size: 0.75rem;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>