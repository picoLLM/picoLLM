<script lang="ts">
    export let checked: boolean = false;
    export let label: string = '';
    export let disabled: boolean = false;

    function handleChange(event: Event) {
        const target = event.target as HTMLInputElement;
        checked = target.checked;
    }
</script>

<label class="custom-checkbox" class:disabled>
    <div class="checkbox-container">
        <input
            type="checkbox"
            {disabled}
            bind:checked
            on:change={handleChange}
        />
        <span class="checkbox-custom">
            {#if checked}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {/if}
        </span>
    </div>
    <span class="label-text">{label}</span>
</label>

<style>
    .custom-checkbox {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        user-select: none;
        padding: 8px;
        border-radius: 6px;
        transition: background-color 0.2s;
    }

    .custom-checkbox:hover {
        background-color: rgba(255, 255, 255, 0.05);
    }

    .checkbox-container {
        position: relative;
        width: 20px;
        height: 20px;
    }

    input[type="checkbox"] {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }

    .checkbox-custom {
        position: absolute;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        background-color: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    input[type="checkbox"]:checked + .checkbox-custom {
        background-color: #007aff;
        border-color: #007aff;
    }

    .checkbox-custom svg {
        width: 14px;
        height: 14px;
        color: white;
        opacity: 0;
        transform: scale(0.8);
        transition: all 0.2s ease;
    }

    input[type="checkbox"]:checked + .checkbox-custom svg {
        opacity: 1;
        transform: scale(1);
    }

    .label-text {
        color: #ffffff;
        font-size: 0.9rem;
    }

    .custom-checkbox.disabled {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
    }

    .custom-checkbox:focus-within .checkbox-custom {
        box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.3);
    }

    @media (hover: hover) {
        .custom-checkbox:hover:not(.disabled) .checkbox-custom {
            border-color: rgba(255, 255, 255, 0.4);
        }
    }
</style>