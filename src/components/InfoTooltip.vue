<script setup>
import { useId } from 'vue';

defineProps({
  label: { type: String, required: true },
});

const tooltipId = `info-${useId()}`;
</script>

<template>
  <span class="info-tooltip">
    <button
      type="button"
      class="info-trigger"
      :aria-label="label"
      :aria-describedby="tooltipId"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </svg>
    </button>
    <span :id="tooltipId" class="tooltip-bubble" role="tooltip">
      <slot />
    </span>
  </span>
</template>

<style scoped>
.info-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.info-trigger {
  display: inline-grid;
  width: 24px;
  height: 24px;
  padding: 0;
  place-items: center;
  color: var(--text-muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: help;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.info-trigger:hover,
.info-trigger:focus-visible {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
  outline: none;
}
.tooltip-bubble {
  position: absolute;
  z-index: 20;
  top: calc(100% + 8px);
  left: 0;
  width: max-content;
  max-width: min(290px, calc(100vw - 48px));
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.55;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
}
.tooltip-bubble::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 8px;
  width: 9px;
  height: 9px;
  background: var(--surface);
  border-top: 1px solid var(--border-strong);
  border-left: 1px solid var(--border-strong);
  transform: rotate(45deg);
}
.info-tooltip:hover .tooltip-bubble,
.info-tooltip:focus-within .tooltip-bubble {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.tooltip-bubble :deep(code) {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--accent);
}
</style>
