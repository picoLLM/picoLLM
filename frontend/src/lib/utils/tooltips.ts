/**
 * Position a tooltip directly above the element being hovered
 */
export function positionTooltip(event: MouseEvent | FocusEvent, tooltipId: string): void {
  const tooltip = document.getElementById(tooltipId);
  if (!tooltip) return;
  
  const triggerElement = event.currentTarget as HTMLElement;
  const triggerRect = triggerElement.getBoundingClientRect();
  
  // Make tooltip visible for measurement
  tooltip.style.cssText = 'display: block; visibility: hidden; opacity: 0;';
  void tooltip.offsetWidth; // Force reflow
  
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Calculate left position to align tooltip with the trigger element
  // Position directly above the trigger element (left-aligned)
  let left = window.scrollX + triggerRect.left;
  
  // Prevent tooltip from going off the right edge of the screen
  const viewportWidth = window.innerWidth;
  if (left + tooltipRect.width > viewportWidth - 10) {
    left = viewportWidth - tooltipRect.width - 10;
  }
  
  // Prevent tooltip from going off the left edge
  if (left < 10) {
    left = 10;
  }
  
  // Calculate top position (above or below trigger)
  const viewportHeight = window.innerHeight;
  const topSpace = triggerRect.top;
  const bottomSpace = viewportHeight - triggerRect.bottom;
  const tooltipHeight = tooltipRect.height;
  
  let top;
  if (topSpace >= tooltipHeight + 12 || topSpace > bottomSpace) {
    // Show above if there's enough space or more space above than below
    tooltip.classList.remove('tooltip-below');
    top = window.scrollY + triggerRect.top - tooltipHeight - 12;
  } else {
    // Show below otherwise
    tooltip.classList.add('tooltip-below');
    top = window.scrollY + triggerRect.bottom + 12;
  }
  
  // Set arrow position to point at center of trigger
  const arrowOffset = (triggerRect.left + triggerRect.width / 2) - left;
  tooltip.style.setProperty('--arrow-offset', `${arrowOffset}px`);
  
  // Apply positions
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  
  // Make tooltip visible
  requestAnimationFrame(() => {
    tooltip.classList.add('visible');
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';
  });
}

/**
 * Hide a tooltip
 */
export function hideTooltip(tooltipId: string): void {
  const tooltip = document.getElementById(tooltipId);
  if (!tooltip) return;
  
  tooltip.classList.remove('visible');
  tooltip.style.opacity = '0';
  
  setTimeout(() => {
    if (!tooltip.classList.contains('visible')) {
      tooltip.style.visibility = 'hidden';
      tooltip.style.display = 'none';
    }
  }, 250);
}
  /**
   * Generates a unique tooltip ID for a specific metadata item
   * @param metadataId The parent metadata ID
   * @param index The index of the item
   * @returns A unique tooltip ID string
   */
  export function getTooltipId(metadataId: string | undefined, index: number): string {
    return `tooltip-${metadataId || 'metadata'}-${index}`;
  }
  
  /**
   * Generates a unique tooltip ID for the "more" button
   * @param metadataId The parent metadata ID
   * @returns A unique tooltip ID string
   */
  export function getMoreTooltipId(metadataId: string | undefined): string {
    return `more-tooltip-${metadataId || 'metadata'}`;
  }
  
  /**
   * Truncates text to a specified length and adds ellipsis if needed
   * @param text The text to truncate
   * @param maxLength Maximum length before truncation
   * @returns Truncated text with ellipsis if necessary
   */
  export function truncateText(text: string, maxLength: number = 25): string {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }