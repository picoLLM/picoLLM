<script lang="ts">
  export let size: 'small' | 'medium' | 'large' = 'medium';
</script>
<div class="loading-animation {size}">
  <span class="dot"></span>
  <span class="dot"></span>
  <span class="dot"></span>
</div>
<style>
  .loading-animation {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 0.25rem;
    min-width: 2rem;
    height: 1rem;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    background-color: currentColor;
    border-radius: 50%;
    opacity: 0.4;
    animation: bounce 1.2s infinite ease-in-out both;
  }
  .small .dot {
    width: 0.25rem;
    height: 0.25rem;
  }
  .large .dot {
    width: 0.7rem;
    height: 0.7rem;
  }
  .dot:nth-child(1) {
    animation-delay: -0.32s;
  }
  .dot:nth-child(2) {
    animation-delay: -0.16s;
  }
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    50% {
      transform: translateY(-0.2rem);
      opacity: 1;
    }
  }
</style>