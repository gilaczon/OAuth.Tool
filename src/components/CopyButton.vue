<script setup>
import { ref } from 'vue';

const props = defineProps({
  value: { type: [String, Object, Number], default: '' },
  label: { type: String, default: 'Copy' },
  title: { type: String, default: 'Copy to clipboard' },
});

const copied = ref(false);
let timer = null;

async function copy() {
  const text =
    typeof props.value === 'string' ? props.value : JSON.stringify(props.value, null, 2);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for insecure contexts / older browsers.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* ignore */
    }
    document.body.removeChild(ta);
  }
  copied.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (copied.value = false), 1400);
}
</script>

<template>
  <button
    type="button"
    class="copy-btn"
    :class="{ copied }"
    :title="title"
    @click="copy"
  >
    <svg
      v-if="!copied"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
    <svg
      v-else
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
    <span>{{ copied ? 'Copied' : label }}</span>
  </button>
</template>

<style scoped>
.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.copy-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}
.copy-btn.copied {
  color: var(--success);
  border-color: var(--success);
  background: var(--success-soft);
}
</style>
