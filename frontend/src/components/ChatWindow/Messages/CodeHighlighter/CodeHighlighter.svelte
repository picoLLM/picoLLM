<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { SyntaxHighlightService } from '$lib/features/highlighter/highlighter';
	import { theme, colorTheme } from '$lib/stores/theme';
	import {
		vscodeThemes,
		customThemes,
		SyntaxColors,
		VSCodeSyntaxColors
	} from '$lib/features/highlighter/highlighter.constants';

	// Props
	export let code = '';
	export let language = '';
	export let langtag = false;
	export let messageId: string;
	export let showLineNumbers = true;

	// DOM refs
	let codeElement: HTMLElement;
	let containerElement: HTMLElement;
	
	// State
	let highlightedCode = '';
	let error: string | null = null;
	let copied = false;
	
	// Performance optimization: Track if component is ready
	let isReady = false;
	
	// Memoization for expensive computations
	let previousCode = '';
	let previousLanguage = '';
	
	// Extract constants
	const { COPY_TIMEOUT, ERROR_TIMEOUT, COPY_ICON } = SyntaxHighlightService;

	// Reactive theme calculations
	$: currentTheme = $theme || 'dark';
	$: currentColorTheme = $colorTheme || 'vscode';
	$: themeConfig = currentColorTheme === 'vscode' ? vscodeThemes : customThemes;
	$: themeVars = themeConfig[currentTheme] ?? themeConfig.dark;
	$: styleString = SyntaxHighlightService.generateStyleString(
		themeVars,
		SyntaxColors,
		VSCodeSyntaxColors
	);

	function updateHighlighting(): void {
		if (!isReady || !code) return;
		
		// Skip if nothing changed
		if (code === previousCode && language === previousLanguage) return;
		
		try {
			highlightedCode = SyntaxHighlightService.highlight(code, language);
			previousCode = code;
			previousLanguage = language;
			error = null;
		} catch (err) {
			console.error('Highlighting failed:', err);
			error = 'Failed to highlight code';
		}
	}
	async function handleCopy(): Promise<void> {
		if (copied) return; // Prevent multiple rapid clicks
		
		try {
			const success = await SyntaxHighlightService.copyCodeToClipboard(code);
			if (success) {
				copied = true;
				setTimeout(() => (copied = false), COPY_TIMEOUT);
			} else {
				setError('Unable to copy code');
			}
		} catch (err) {
			console.error('Copy failed:', err);
			setError('Unable to copy code');
		}
	}

	function setError(message: string): void {
		error = message;
		setTimeout(() => (error = null), ERROR_TIMEOUT);
	}

	onMount(() => {
		isReady = true;
		updateHighlighting();
	});

	onDestroy(() => {
		isReady = false;
	});

	$: if (isReady && (code !== previousCode || language !== previousLanguage)) {
		updateHighlighting();
	}
</script>

<div
	class="code-highlighter"
	class:dark={currentTheme === 'dark'}
	class:light={currentTheme === 'light'}
	class:vscode-theme={currentColorTheme === 'vscode'}
	data-message-id={messageId}
	style={styleString}
	bind:this={containerElement}
>
	<div class="code-header">
		<div class="header-content">
			{#if langtag && language}
				<span class="language-tag">{SyntaxHighlightService.getDisplayLanguage(language)}</span>
			{/if}
			<button 
				class="copy-button" 
				on:click={handleCopy} 
				aria-label="Copy code" 
				title="Copy code"
				disabled={copied}
			>
				<span class="button-content">
					{#if copied}
						<span transition:fade={{ duration: 200 }}>Copied!</span>
					{:else}
						{@html COPY_ICON}
						<span class="icon-text">Copy</span>
					{/if}
				</span>
			</button>
		</div>
	</div>

	<div class="code-container">
		<div class="code-content" bind:this={codeElement}>
			<pre class="hljs-pre"><code 
				class="hljs language-{SyntaxHighlightService.getDisplayLanguage(language)}"
			>{@html SyntaxHighlightService.addLineNumbers(
				highlightedCode || code,
				showLineNumbers
			)}</code></pre>
		</div>
	</div>

	{#if error}
		<div class="error-message" transition:fade={{ duration: 200 }}>
			{error}
		</div>
	{/if}
</div>

<style>
	@import '../../../../lib/styles/components/ChatWindow/Messages/highlighter.css';
</style>