<!-- Actions.svelte -->
<script lang="ts">
import { createEventDispatcher, onMount } from 'svelte';
import { Settings, Home, FolderPlus, LogIn, Sun, Moon, Download, FileDown, Database } from 'lucide-svelte';
import Dashboard from '$components/Toolbox/Icons/Dashboard.svelte';
import { themeStore, colorTheme } from '$lib/stores/theme';
import { exportAllSessions as apiExportAll, exportSessions as apiExportSessions } from '$lib/api/export';

export let isSidebarCollapsed: boolean;

const dispatch = createEventDispatcher<{
  navigate: string;
}>();

let isMenuOpen = false;
let isExportOpen = false;
let menuContainer: HTMLDivElement;
let exportContainer: HTMLDivElement;

onMount(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (menuContainer && !menuContainer.contains(event.target as Node)) {
      isMenuOpen = false;
    }
    if (exportContainer && !exportContainer.contains(event.target as Node)) {
      isExportOpen = false;
    }
  };

  document.addEventListener('click', handleClickOutside);
  return () => {
    document.removeEventListener('click', handleClickOutside);
  };
});

function navigateTo(page: string) {
  dispatch('navigate', page);
  isMenuOpen = false;
}

function toggleMenu(event: MouseEvent) {
  event.stopPropagation();
  isMenuOpen = !isMenuOpen;
}

function toggleExport(event: MouseEvent) {
  event.stopPropagation();
  isExportOpen = !isExportOpen;
}

function toggleColorTheme() {
  themeStore.toggleColorTheme();
}

async function exportAllSessions(includeMetadata: boolean = false, includeEmpty: boolean = false) {
  try {
    await apiExportAll({ includeMetadata, includeEmpty });
    isExportOpen = false;
  } catch (error) {
    console.error('Export failed:', error);
    // Optionally show user notification here
  }
}

async function exportCurrentSession() {
  const sessionId = getCurrentSessionId();
  
  if (!sessionId) {
    console.error('No active session');
    // Optionally show user notification here
    return;
  }
  
  try {
    await apiExportSessions([sessionId]);
    isExportOpen = false;
  } catch (error) {
    console.error('Export failed:', error);
    // Optionally show user notification here
  }
}

// Placeholder - implement based on your session management
function getCurrentSessionId(): number | null {
  // Return the current session ID from your store/context
  return null;
}
</script>

<div class="actions-section">
  <div
    class="additional-actions-container"
    class:collapsed={isSidebarCollapsed}
    bind:this={menuContainer}
  >
    {#if isSidebarCollapsed}
      <div class="collapsed-menu">
        <button class="icon-button" on:click={toggleColorTheme} aria-label="Toggle theme">
          {#if $colorTheme === 'custom'}
            <Moon size={20} />
          {:else}
            <Sun size={20} />
          {/if}
        </button>
        <div class="export-wrapper collapsed-export" bind:this={exportContainer}>
          <button class="icon-button" on:click={toggleExport} aria-label="Export" class:active={isExportOpen}>
            <Download size={20} />
          </button>
        </div>
      {#if isExportOpen && isSidebarCollapsed}
        <div class="collapsed-export-menu">
          <button on:click={() => exportCurrentSession()} class="icon-button" title="Export current session">
            <FileDown size={20} />
          </button>
          <button on:click={() => exportAllSessions()} class="icon-button" title="Export all sessions">
            <Database size={20} />
          </button>
        </div>
      {/if}
        <button class="icon-button" on:click={() => navigateTo('/')}>
          <Home size={20} />
        </button>
        <button class="icon-button" on:click={() => navigateTo('/dashboard')}>
          <FolderPlus size={20} />
        </button>
        <button class="icon-button" on:click={() => navigateTo('/login')}>
          <LogIn size={20} />
        </button>
      </div>
    {:else}
      <button class="toggle-menu-button" class:active={isMenuOpen} on:click={toggleMenu}>
        <Settings size={18} />
        <span>Menu</span>
      </button>
      {#if isMenuOpen}
        <div class="additional-actions-menu">
          <div class="action-group">
            <button on:click={toggleColorTheme} class="nav-button">
              {#if $colorTheme === 'custom'}
                <Moon size={16} />
              {:else}
                <Sun size={16} />
              {/if}
              <div class="button-content">
                <span class="button-title">
                  {$colorTheme === 'custom' ? 'VS Code Theme' : 'Custom Theme'}
                </span>
                <span class="button-subtitle">Change editor appearance</span>
              </div>
            </button>
          </div>
          
          <div class="action-group">
            <button on:click={toggleExport} class="nav-button" class:active={isExportOpen}>
              <Download size={16} />
              <div class="button-content">
                <span class="button-title">Export Chat</span>
                <span class="button-subtitle">Download conversations</span>
              </div>
              <span class="submenu-indicator">{isExportOpen ? '▼' : '▶'}</span>
            </button>
            {#if isExportOpen}
              <div class="export-options">
                <button on:click={() => exportCurrentSession()} class="submenu-item">
                  <FileDown size={14} />
                  <span>Current Session</span>
                </button>
                <button on:click={() => exportAllSessions()} class="submenu-item">
                  <Database size={14} />
                  <span>All Sessions</span>
                </button>
                <button on:click={() => exportAllSessions(true)} class="submenu-item">
                  <Database size={14} />
                  <span>All with Metadata</span>
                </button>
                <button on:click={() => exportAllSessions(false, true)} class="submenu-item">
                  <Database size={14} />
                  <span>All (Include Empty)</span>
                </button>
              </div>
            {/if}
          </div>
          
          <div class="action-group">
            <button on:click={() => navigateTo('/')} class="nav-button">
              <Home size={16} />
              <span>Home</span>
            </button>
            <button on:click={() => navigateTo('/dashboard')} class="nav-button">
              <Dashboard />
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  @import '../../lib/styles/components/Sidebar/additional-actions.css';
  
  /* Additional styles for export functionality */
  .export-wrapper {
    position: relative;
  }
  
  .nav-button {
    position: relative;
  }
  
  .nav-button.active {
    background: var(--hover-color);
  }
  
  .submenu-indicator {
    margin-left: auto;
    font-size: 10px;
    opacity: 0.6;
    transition: transform 0.2s;
  }
  
  .export-options {
    margin-top: 4px;
    margin-left: 24px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .submenu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    width: 100%;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 13px;
    border-radius: 4px;
    text-align: left;
  }
  
  .submenu-item:hover {
    background: var(--hover-color);
  }
  
  .collapsed-export-menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
    border-top: 1px solid var(--border-color);
    margin-top: 8px;
  }
  
  .icon-button.active {
    background: var(--hover-color);
  }
</style>