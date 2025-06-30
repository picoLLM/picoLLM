import { createEventDispatcher } from 'svelte';
import { settingsStore } from '$lib/stores/settings';
import { tick } from 'svelte';

export const createChatEvents = () => {
	const dispatch = createEventDispatcher();

	const handleSuggestionSelect = (event: CustomEvent<string>) => {
		const selectedSuggestion = event.detail;
		dispatch('prefillMessage', selectedSuggestion);
		return selectedSuggestion;
	};

	const handleToggleSettings = () => {
		dispatch('toggleSettings');
	};

	const handleUpdateSettings = (event: CustomEvent) => {
		settingsStore.update(event.detail);
	};

	const createTransitionHandlers = () => {
		let isTransitioning = false;

		const handleTransitionStart = async () => {
			isTransitioning = true;
			await tick();
			return isTransitioning;
		};

		const handleTransitionEnd = () => {
			isTransitioning = false;
			return isTransitioning;
		};

		return {
			isTransitioning,
			handleTransitionStart,
			handleTransitionEnd
		};
	};

	return {
		handleSuggestionSelect,
		handleToggleSettings,
		handleUpdateSettings,
		createTransitionHandlers
	};
};
