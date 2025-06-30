<script lang="ts">
  import LoadingAnimation from './LoadingAnimation.svelte';
</script>
<div class="message-container assistant">
  <div class="message loading-message">
    <div class="message-content loading">
      <LoadingAnimation size="small" />
    </div>
  </div>
</div>
<style>
  .message-container {
    display: flex;
    width: 100%;
    margin-bottom: 1rem;
  }
  .message-container.assistant {
    justify-content: flex-start;
  }
  .message {
    max-width: 70%;
    border-radius: 18px;
    overflow: hidden;
    background-color: #444;
    color: white;
  }
  /* Add specific styling for loading message containers */
  .loading-message {
    max-width: fit-content;
    min-width: auto;
    width: auto;
  }
  .message-content {
    padding: 0.5rem 0.8rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    min-height: 24px;
    display: flex;
    align-items: center;
  }
  /* Make loading content smaller with tighter padding */
  .message-content.loading {
    padding: 0.4rem 0.6rem;
    min-height: 20px;
    min-width: auto;
    width: auto;
  }
</style>