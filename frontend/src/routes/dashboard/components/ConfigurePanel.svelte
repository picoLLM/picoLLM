<script lang="ts">
	import { Settings, Loader2 } from 'lucide-svelte';
	import StyledInput from '../../../components/Toolbox/Inputs/FlexboxInput.svelte';
	import CustomCheckbox from '../../../components/Toolbox/Inputs/Checkbox.svelte';
	import ProgressIndicator from './ProgressIndicator.svelte';
	import CompactField from './CompactField.svelte';
	import { buildStore } from '../stores/build';
	import { buildCollection } from '../services/build-collection';

	let collectionName = '';
	let datasetInput = '';
	let loadFromDisk = false;
	let split = '';
	let textField = '';
	let batchSize = '4';
	let useMatryoshka = false;
	let useQuantization = false;

	$: datasetNames = datasetInput
		.split(',')
		.map(n => n.trim())
		.filter(n => n.length > 0);

	$: canBuild = !$buildStore.isBuilding && collectionName && datasetNames.length > 0;

	async function handleBuild() {
		await buildCollection({
			collection_name: collectionName,
			dataset_names: datasetNames,
			load_from_disk: loadFromDisk,
			split: split || 'train',
			text_field: textField || 'text',
			batch_size: parseInt(batchSize) || 4,
			use_quantization: useQuantization,
			use_matryoshka: useMatryoshka
		});
	}
</script>

<div class="panel configure-panel">
	<div class="panel-header">
		<Settings size={16} />
		<h3>Configure Collection</h3>
	</div>
	
	<div class="panel-content">
		<form on:submit|preventDefault={handleBuild}>
			<div class="fields">
				<CompactField label="Collection Name" required>
					<StyledInput
						label=""
						bind:value={collectionName}
						placeholder="my_collection"
					/>
				</CompactField>

				<CompactField label="Datasets" required>
					<StyledInput
						label=""
						bind:value={datasetInput}
						placeholder="dataset1, dataset2"
					/>
				</CompactField>

				{#if datasetNames.length > 0}
					<div class="tags">
						{#each datasetNames as d}
							<span class="tag">{d}</span>
						{/each}
					</div>
				{/if}
			</div>

			<div class="options">
				<h4>Processing Options</h4>
				
				<div class="grid">
					<CompactField label="Split">
						<StyledInput label="" bind:value={split} placeholder="train" />
					</CompactField>

					<CompactField label="Text Field">
						<StyledInput label="" bind:value={textField} placeholder="text" />
					</CompactField>

					<CompactField label="Batch Size">
						<StyledInput label="" bind:value={batchSize} placeholder="4" />
					</CompactField>
				</div>

				<div class="checks">
					<CustomCheckbox bind:checked={loadFromDisk} label="Load from Disk" />
					<CustomCheckbox bind:checked={useQuantization} label="Quantization" />
					<CustomCheckbox bind:checked={useMatryoshka} label="Matryoshka" />
				</div>
			</div>

			{#if $buildStore.progress || $buildStore.error}
				<div class="status">
					{#if $buildStore.progress}
						<ProgressIndicator progress={$buildStore.progress} />
					{/if}
					{#if $buildStore.error}
						<div class="error">{$buildStore.error}</div>
					{/if}
				</div>
			{/if}

			<button type="submit" class="btn" disabled={!canBuild}>
				{#if $buildStore.isBuilding}
					<Loader2 class="spin" size={16} />
					<span>Building...</span>
				{:else}
					Build Collection
				{/if}
			</button>
		</form>
	</div>
</div>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		height: 100%;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #2a2a2a;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.tag {
		background: rgba(0, 122, 255, 0.1);
		color: #007aff;
		padding: 0.125rem 0.375rem;
		border-radius: 6px;
		font-size: 0.688rem;
		font-weight: 500;
		border: 1px solid rgba(0, 122, 255, 0.2);
	}

	.options h4 {
		font-size: 0.75rem;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		margin: 0 0 0.625rem 0;
	}

	.grid {
		display: grid;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.checks {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 6px;
		border: 1px solid #2a2a2a;
	}

	.status {
		margin-top: auto;
		animation: slideIn 0.3s ease;
	}


	.error {
		background: rgba(239, 68, 68, 0.08);
		color: #ef4444;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.btn {
		width: 100%;
		padding: 0.5rem;
		background: #007aff;
		border: none;
		border-radius: 6px;
		color: #fff;
		font-size: 0.813rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: auto;
	}

	.btn:hover:not(:disabled) {
		background: #0056b3;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);
	}

	.btn:disabled {
		background: #2a2a2a;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
