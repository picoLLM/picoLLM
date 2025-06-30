<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { AlertCircle, CheckCircle2, Download, Loader2, ExternalLink } from 'lucide-svelte';
	import { ollamaProgress } from '$lib/stores/ollama-progress';
	import { 
		formatSize, 
		formatTime, 
		getStatusMessage, 
		getProgressPercent,
		hasProgressData as checkHasProgressData,
		isVersionError as checkIsVersionError
	} from '$lib/utils/ollama-progress';

	let startTime: number | null = null;
	let progressTime = '00:00';
	let timer: ReturnType<typeof setInterval>;
	let indeterminateProgress = 5;

	$: progressPercent = getProgressPercent($ollamaProgress.progressStatus, indeterminateProgress);
	$: isVersionError = checkIsVersionError($ollamaProgress.progressStatus);
	$: hasProgressData = checkHasProgressData($ollamaProgress.progressStatus);

	// Watch for progress changes and handle them
	$: {
		if ($ollamaProgress.progressStatus) {
			// Start the timer when pulling begins
			if (!startTime && $ollamaProgress.isDownloading) {
				startTime = Date.now();
			}
			
			// Reset when download is complete
			if ($ollamaProgress.progressStatus.status === 'success') {
				setTimeout(() => {
					ollamaProgress.stopDownload();
				}, 3000);
			}
		}
	}

	onMount(() => {
		timer = setInterval(() => {
			// Update elapsed time
			if (startTime) {
				progressTime = formatTime(Date.now() - startTime);
			}
			
			// Animate indeterminate progress
			if ($ollamaProgress.isDownloading && !hasProgressData) {
				// Use different animation speed based on current value
				if (indeterminateProgress < 30) {
					indeterminateProgress += 2;
				} else if (indeterminateProgress < 60) {
					indeterminateProgress += 1;
				} else if (indeterminateProgress < 90) {
					indeterminateProgress += 0.5;
				} else {
					indeterminateProgress = 5; // Reset to start
				}
			}
		}, 500);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
		startTime = null;
	});
	
	function closeProgress() {
		ollamaProgress.stopDownload();
	}
	
	function openOllamaDownload() {
		window.open('https://ollama.com/download', '_blank');
	}
</script>

{#if $ollamaProgress.isDownloading}
	<div class="progress-overlay">
		<div class="progress-container">
			<div class="progress-content">
				<!-- Status Header -->
				<div class="status-header">
					{#if $ollamaProgress.progressStatus?.status === 'success'}
						<CheckCircle2 size={16} />
					{:else if $ollamaProgress.progressStatus?.status === 'error'}
						<AlertCircle size={16} />
					{:else if $ollamaProgress.progressStatus?.status?.startsWith('pulling')}
						<Download size={16} />
					{:else}
						<div class="animate-spin">
							<Loader2 size={16} />
						</div>
					{/if}
					<span class="status-message">
						{getStatusMessage($ollamaProgress.progressStatus)}
					</span>
					
					<!-- Add close button for errors -->
					{#if $ollamaProgress.progressStatus?.status === 'error' && !isVersionError}
						<button class="close-button" on:click={closeProgress}>×</button>
					{/if}
				</div>

				<!-- Always show progress bar during download -->
				<div class="progress-details">
					<div class="progress-bar-container">
						<div
							class="progress-bar {!hasProgressData && $ollamaProgress.progressStatus?.status !== 'success' ? 'pulse-animation' : ''} {$ollamaProgress.progressStatus?.status === 'error' ? 'error-bar' : ''}"
							style="width: {progressPercent}%"
						>
							<div class="progress-glow"></div>
						</div>
					</div>

					{#if $ollamaProgress.progressStatus}
						<div class="stats-grid">
							<div class="stats-column">
								<div class="stat-row">
									{#if $ollamaProgress.progressStatus.status === 'pulling manifest'}
										Progress: Preparing...
									{:else if $ollamaProgress.progressStatus.status === 'error' && isVersionError}
										Error: Ollama update required
									{:else if $ollamaProgress.progressStatus.status === 'error'}
										Error: Model not found
									{:else if hasProgressData}
										Progress: {formatSize($ollamaProgress.progressStatus.completed)} / {formatSize(
											$ollamaProgress.progressStatus.total
										)}
									{:else if $ollamaProgress.progressStatus.status === 'success'}
										Progress: Complete
									{:else}
										Progress: {$ollamaProgress.progressStatus.status || 'Processing...'}
									{/if}
								</div>
							</div>
							<div class="stats-column right">
								<div class="stat-row">
									Time: {progressTime}
								</div>
							</div>
						</div>
						
						<!-- Version update specific UI -->
						{#if isVersionError}
							<div class="version-update-container">
								<p class="version-message">Please update Ollama to use this model</p>
								<button class="download-button" on:click={openOllamaDownload}>
									<ExternalLink size={14} />
									Download Update
								</button>
								<button class="close-button-inline" on:click={closeProgress}>
									Close
								</button>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@import '../../../lib/styles/components/TopBar/ollama-pull-progress.css';
</style>