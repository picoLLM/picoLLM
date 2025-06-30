<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { ArrowUpCircle, Mic, File as FileIcon, X, FileText } from 'lucide-svelte';
	import Finder from '$components/Toolbox/Icons/Finder.svelte';
	import { MessageService } from '$lib/services/input/message-input';
	import type { FileInfo } from '$lib/types/components/message-input';

	export let prefillMessage = '';
	export const messageService = new MessageService();

	let inputElement: HTMLDivElement;
	let fileInputElement: HTMLInputElement;
	let filePreview: string | null = null;
	let stagedFileForDisplay: FileInfo | null = null;
	let pendingFileTransfer = false;

	const dispatch = createEventDispatcher();

	const handleInput = (e: Event) => {
		messageService.inputMessage = (e.currentTarget as HTMLDivElement).innerText.trim();
		if (!messageService.inputMessage && inputElement) {
			inputElement.innerText = '';
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	const sendMessage = () => {
		if (!messageService.hasValidInput()) return;

		const hasImage = !!messageService.stagedFile;
		const message = messageService.inputMessage.trim();

		if (hasImage) {
			pendingFileTransfer = true;
			stagedFileForDisplay = null;
		}

		dispatch('sendMessage', { text: message, hasImage });

		messageService.clearInputMessage();
		if (inputElement) inputElement.innerText = '';
	};

	const updateFilePreview = () => {
		if (messageService.stagedFile?.type === 'image' && messageService.stagedFile.preview) {
			filePreview = messageService.stagedFile.preview;
			if (!pendingFileTransfer) {
				stagedFileForDisplay = messageService.stagedFile;
			}
		} else {
			filePreview = null;
			stagedFileForDisplay = null;
		}
	};

	const handleFileSelect = async (e: Event) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			try {
				await messageService.handleFile(file);
				updateFilePreview();
			} catch (error) {
				console.error('Error processing file:', error);
			}
		}
	};

	const handleDrop = async (e: DragEvent) => {
		await messageService.handleDrop(e);
		updateFilePreview();
	};

	const handlePaste = async (e: ClipboardEvent) => {
		const hasImageInClipboard = Array.from(e.clipboardData?.items || []).some(
			(item) => item.kind === 'file' && item.type.startsWith('image/')
		);

		if (hasImageInClipboard) {
			e.preventDefault();
			const imageProcessed = await messageService.handleClipboardPaste(e);
			if (imageProcessed) {
				updateFilePreview();
			}
		}
	};

	const removeFile = () => {
		messageService.removeFile();
		filePreview = null;
		stagedFileForDisplay = null;
		pendingFileTransfer = false;
		if (fileInputElement) fileInputElement.value = '';
	};

	export const clearStagedFile = () => {
		removeFile();
	};

	export const focus = () => inputElement?.focus();

	$: if (prefillMessage && inputElement) {
		messageService.inputMessage = prefillMessage;
		inputElement.innerText = prefillMessage;
		inputElement.focus();
		prefillMessage = '';
	}

	$: if (messageService.stagedFile?.preview && !pendingFileTransfer) {
		filePreview = messageService.stagedFile.preview;
		stagedFileForDisplay = messageService.stagedFile;
	} else if (!messageService.stagedFile) {
		filePreview = null;
		stagedFileForDisplay = null;
	}

	onMount(() => {
		if (inputElement) {
			inputElement.innerText = messageService.inputMessage;
			inputElement.addEventListener('paste', handlePaste);
		}
		if (messageService.stagedFile) {
			stagedFileForDisplay = messageService.stagedFile;
		}
		return () => inputElement?.removeEventListener('paste', handlePaste);
	});
</script>

<div
	class="message-input-container"
	class:has-file={stagedFileForDisplay}
	role="group"
	aria-label="Message input"
	class:dragging={messageService.isDragging}
	on:dragenter={(e) => messageService.handleDragEnter(e)}
	on:dragleave={(e) => messageService.handleDragLeave(e)}
	on:dragover|preventDefault
	on:drop={handleDrop}
>
	<div
		class="message-input"
		contenteditable="true"
		bind:this={inputElement}
		on:input={handleInput}
		on:keydown={handleKeyDown}
		role="textbox"
		aria-multiline="true"
		aria-label="Type your message"
		data-placeholder="Type your message here..."
		tabindex="0"
	/>

	<div class="bottom-bar">
		<div class="file-section">
			{#if stagedFileForDisplay}
				<div class="staged-file" class:is-image={stagedFileForDisplay.type === 'image'}>
					<div class="file-content">
						{#if stagedFileForDisplay.type === 'image' && filePreview}
							<div class="preview-container">
								<img src={filePreview} alt="Preview" class="file-preview" />
							</div>
						{:else}
							<div class="document-icon">
								<FileText size={16} />
							</div>
						{/if}
						<div class="file-info">
							<span class="file-name">{stagedFileForDisplay.file.name}</span>
							<span class="file-meta">
								{messageService.formatFileSize(stagedFileForDisplay.file.size)}
							</span>
						</div>
					</div>
					<button class="remove-file" on:click={removeFile} aria-label="Remove file">
						<X size={14} />
					</button>
				</div>
			{/if}
		</div>

		<div class="icon-container">
			<input
				type="file"
				bind:this={fileInputElement}
				on:change={handleFileSelect}
				id="file-input"
				class="hidden"
				accept="image/*,.pdf,.doc,.docx,.txt"
			/>
			<button
				class="icon file"
				on:click={() => fileInputElement.click()}
				aria-label="Upload file"
				type="button"
			>
				<Finder />
			</button>
			<button
				class="icon mic"
				on:click={() => console.log('Microphone clicked')}
				aria-label="Activate microphone"
				type="button"
			>
				<Mic size={18} />
			</button>
			<button
				class="icon send"
				on:click={sendMessage}
				aria-label="Send message"
				type="button"
				disabled={!messageService.hasValidInput()}
			>
				<ArrowUpCircle size={18} />
			</button>
		</div>
	</div>
</div>

<style>
	@import '../../lib/styles/components/MessageInput/message-input.css';
</style>
