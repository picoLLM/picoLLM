<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Close from '$components/Toolbox/Icons/Close.svelte';
	import { DEFAULT_TOOL } from '$lib/constants/add-tools.constants';
	import { registerTool, type ToolPayload } from '$lib/api/tools';
	
	export let isOpen = false;
	
	const dispatch = createEventDispatcher();
	
	let loading = false;
	let error = '';
	let allowNetwork = false;
	
	// Form state - destructure for reactivity
	let { name: toolName, description, code } = DEFAULT_TOOL;
	let parametersSchema = JSON.stringify(DEFAULT_TOOL.schema, null, 2);
	
	// Validate JSON schema
	function validateSchema(schema: string): { valid: boolean; error?: string } {
		if (!schema.trim()) return { valid: true };
		
		try {
			const parsed = JSON.parse(schema);
			return typeof parsed === 'object' 
				? { valid: true } 
				: { valid: false, error: 'Schema must be a valid JSON object' };
		} catch (e) {
			return { valid: false, error: 'Invalid JSON format' };
		}
	}
	
	function resetForm() {
		({ name: toolName, description, code } = DEFAULT_TOOL);
		parametersSchema = JSON.stringify(DEFAULT_TOOL.schema, null, 2);
		allowNetwork = false;
		error = '';
	}
	
	async function submit() {
		error = '';
		
		// Validate required fields
		if (!toolName.trim() || !description.trim() || !code.trim()) {
			error = 'Please fill in all required fields';
			return;
		}
		
		// Validate schema
		const validation = validateSchema(parametersSchema);
		if (!validation.valid) {
			error = validation.error || 'Invalid schema';
			return;
		}
		
		loading = true;
		try {
			// Parse schema and build payload
			const schema = parametersSchema.trim() ? JSON.parse(parametersSchema) : {};
			const payload: ToolPayload = {
				name: toolName.trim(),
				description: description.trim(),
				code: code.trim(),
				parameters: schema.properties || {},
				required_params: schema.required || [],
				allow_network: allowNetwork
			};
			
			console.log('Registering tool:', payload);
			
			await registerTool(payload);
			
			dispatch('success', { name: toolName });
			close();
		} catch (e: any) {
			console.error('Tool registration error:', e);
			error = e.message || 'Failed to register tool';
		} finally {
			loading = false;
		}
	}
	
	function close() {
		resetForm();
		dispatch('close');
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !loading) close();
	}
	
	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}
	
	// Reactive validation
	$: schemaValidation = parametersSchema ? validateSchema(parametersSchema) : { valid: true };
	$: canSubmit = !loading && toolName && description && code && schemaValidation.valid;
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div 
		class="modal-backdrop" 
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		on:click={handleBackdropClick}
		on:keydown={handleKeydown}
	>
		<div class="modal" role="document">
			<header>
				<h3 id="modal-title">Add Dynamic Tool</h3>
				<button 
					class="icon-btn" 
					on:click={close} 
					disabled={loading}
					aria-label="Close modal"
					type="button"
				>
					<Close />
				</button>
			</header>
			
			<main>
				{#if error}
					<div class="error-message" role="alert">{error}</div>
				{/if}
				
				<div class="form-group">
					<label for="toolName">Tool Name*</label>
					<input
						id="toolName"
						type="text"
						bind:value={toolName}
						placeholder="my_custom_tool"
						disabled={loading}
						aria-required="true"
					/>
				</div>
				
				<div class="form-group">
					<label for="description">Description*</label>
					<textarea
						id="description"
						bind:value={description}
						placeholder="What does this tool do?"
						rows="2"
						disabled={loading}
						aria-required="true"
					/>
				</div>
				
				<div class="form-group">
					<label for="code">Function Code*</label>
					<textarea
						id="code"
						bind:value={code}
						placeholder="def tool_function(**kwargs):"
						rows="8"
						disabled={loading}
						aria-required="true"
						class="code-input"
					/>
				</div>
				
				<div class="form-group">
					<label for="schema">
						Parameters Schema (JSON)
						<span class="hint">Optional - Define parameters using JSON Schema format</span>
					</label>
					<textarea
						id="schema"
						bind:value={parametersSchema}
						placeholder={`{\n  "properties": {},\n  "required": []\n}`}
						rows="6"
						disabled={loading}
						class="code-input"
					/>
					{#if !schemaValidation.valid}
						<span class="error-text">{schemaValidation.error}</span>
					{/if}
				</div>
				
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={allowNetwork}
						disabled={loading}
					/>
					Allow network access
				</label>
			</main>
			
			<footer>
				<button 
					class="btn secondary"
					on:click={close} 
					disabled={loading} 
					type="button"
				>
					Cancel
				</button>
				<button
					class="btn primary"
					on:click={submit}
					disabled={!canSubmit}
					type="button"
				>
					{loading ? 'Adding...' : 'Add Tool'}
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
    @import '../../lib/styles/components/ToolSettingsMenu/add-tool-modal.css';
</style>