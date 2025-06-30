declare module 'highlight.js';
declare module 'marked';
declare module 'dompurify';

// src/global.d.ts

import { SvelteHTMLElements } from 'svelte/elements';

declare module 'svelte/elements' {
  export interface SvelteHTMLElements {
    'div': {
      'on:clickoutside'?: (event: CustomEvent) => void;
    } & HTMLAttributes<HTMLDivElement>;
  }
}