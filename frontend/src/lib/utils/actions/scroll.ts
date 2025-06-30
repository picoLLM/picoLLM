import { writable, get } from 'svelte/store';

// Auto-scroll state
export const autoScrollEnabled = writable(true);

// Element with scroll capability
export interface ScrollableElement extends HTMLElement {
	checkAndScroll?: () => void;
	forceScroll?: () => void;
	stopScrolling?: () => void;
}

export const SCROLL_THRESHOLD = 80;

// Scroll to bottom
export function scrollToBottom(
	element: HTMLElement | null,
	options?: {
		smooth?: boolean;
		force?: boolean;
	}
): void {
	if (!element) return;

	const { smooth = false, force = false } = options || {};

	if (smooth && !force) {
		element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
	} else {
		element.scrollTop = element.scrollHeight;
	}
}

// Svelte action that manages auto-scrolling behavior
export function scrollHandler(
	node: HTMLElement,
	options: { threshold: number; onScroll: (showButton: boolean) => void }
): { destroy: () => void } {
	const { threshold, onScroll } = options;

	let isUserScrolling = false;
	let scrollTimeout: number | null = null;
	let rafId: number | null = null;
	let isStreamingScroll = false;
	let shouldContinueScrolling = false;
	let lastScrollHeight = node.scrollHeight;
	let tableOverflowMode = false;
	let lastTableWidth = 0;

	function isNearBottom(element: HTMLElement): boolean {
		const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
		return distanceFromBottom <= threshold;
	}

	function handleScroll(): void {
		// Ignore programmatic scrolls
		if (isStreamingScroll) {
			isStreamingScroll = false;
			return;
		}

		isUserScrolling = true;
		const nearBottom = isNearBottom(node);
		autoScrollEnabled.set(nearBottom);
		onScroll(!nearBottom);

		if (scrollTimeout) clearTimeout(scrollTimeout);
		scrollTimeout = window.setTimeout(() => {
			isUserScrolling = false;
			scrollTimeout = null;
		}, 150);
	}

	node.addEventListener('scroll', handleScroll, { passive: true });

	// Check if streaming table is causing horizontal overflow
	function checkTableOverflow(): { hasOverflow: boolean; table: HTMLElement | null } {
		const streamingTable = node.querySelector('.markdown-table-wrapper[data-streaming="true"]');
		if (!streamingTable) return { hasOverflow: false, table: null };

		const tableElement = streamingTable as HTMLElement;
		const hasOverflow = tableElement.scrollWidth > tableElement.clientWidth;

		// Track width changes
		if (hasOverflow && tableElement.scrollWidth !== lastTableWidth) {
			lastTableWidth = tableElement.scrollWidth;
			return { hasOverflow: true, table: tableElement };
		}

		return { hasOverflow, table: tableElement };
	}

	// Smooth incremental scroll for streaming content
	function smoothStreamScroll(): void {
		if (!shouldContinueScrolling || !get(autoScrollEnabled) || isUserScrolling) {
			rafId = null;
			shouldContinueScrolling = false;
			tableOverflowMode = false;
			lastTableWidth = 0;
			return;
		}

		// Check for table overflow situation
		const { hasOverflow, table } = checkTableOverflow();

		// Enter table overflow mode if detected
		if (hasOverflow && !tableOverflowMode) {
			tableOverflowMode = true;
			// Force instant scroll to prevent animation conflicts
			isStreamingScroll = true;
			node.scrollTop = node.scrollHeight - node.clientHeight;
		}

		const currentScroll = node.scrollTop;
		const targetScroll = node.scrollHeight - node.clientHeight;
		const diff = targetScroll - currentScroll;

		// Use instant scroll when table is overflowing
		if (tableOverflowMode) {
			if (node.scrollHeight !== lastScrollHeight) {
				isStreamingScroll = true;
				node.scrollTop = targetScroll;
				lastScrollHeight = node.scrollHeight;
			}
			// Exit table overflow mode when table is done streaming
			if (!table || !table.hasAttribute('data-streaming')) {
				tableOverflowMode = false;
				lastTableWidth = 0;
			}
		} else {
			// Normal smooth scroll for non-overflow content
			if (diff > 1) {
				isStreamingScroll = true;
				const step = Math.min(diff * 0.4, 80);
				node.scrollTop = currentScroll + step;
			} else if (diff > 0) {
				isStreamingScroll = true;
				node.scrollTop = targetScroll;
			}
		}

		lastScrollHeight = node.scrollHeight;
		rafId = requestAnimationFrame(smoothStreamScroll);
	}

	// Start auto-scroll for streaming
	function checkAndScroll(): void {
		if (!get(autoScrollEnabled) || isUserScrolling) return;

		// Set flag to continue scrolling
		shouldContinueScrolling = true;

		// Start if not already running
		if (!rafId) {
			rafId = requestAnimationFrame(smoothStreamScroll);
		}
	}

	// Force scroll to bottom (for new messages)
	function forceScroll(): void {
		stopScrolling();
		isStreamingScroll = true;
		scrollToBottom(node, { force: true });
	}

	// Stop any ongoing scrolling
	function stopScrolling(): void {
		shouldContinueScrolling = false;
		tableOverflowMode = false;
		lastTableWidth = 0;
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	(node as ScrollableElement).checkAndScroll = checkAndScroll;
	(node as ScrollableElement).forceScroll = forceScroll;
	(node as ScrollableElement).stopScrolling = stopScrolling;

	return {
		destroy() {
			node.removeEventListener('scroll', handleScroll);
			if (scrollTimeout) clearTimeout(scrollTimeout);
			stopScrolling();
			delete (node as ScrollableElement).checkAndScroll;
			delete (node as ScrollableElement).forceScroll;
			delete (node as ScrollableElement).stopScrolling;
		}
	};
}
