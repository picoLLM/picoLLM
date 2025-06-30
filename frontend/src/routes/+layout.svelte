<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  // Your existing imports and code here

  onMount(() => {
    if (browser) {
      // Place any code that uses document or other browser-only APIs here
      // For example:
      // document.body.classList.add('my-class');
    }
  });
</script>
  
  <div class="app-container">
    <slot />
  </div>
  
  <style>
    :global(body) {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background-color: #1a1a1a;
      color: #ffffff;
    }
  
    .app-container {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }
  
    :global(*) {
      box-sizing: border-box;
    }
    
  </style>
  