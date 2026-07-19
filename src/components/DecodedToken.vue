<script setup>
import { computed, ref, watch } from 'vue';
import CopyButton from './CopyButton.vue';
import {
  decodeJwt,
  CLAIM_DESCRIPTIONS,
  isTimeClaim,
  formatTimestamp,
  relativeTime,
} from '../lib/jwt.js';

const props = defineProps({
  accessToken: { type: String, default: '' },
  now: { type: Number, default: () => Date.now() },
});

const decoded = computed(() => decodeJwt(props.accessToken));
const activeTab = ref('raw');

watch(
  () => props.accessToken,
  () => {
    activeTab.value = 'raw';
  },
);

const claims = computed(() => {
  if (!decoded.value) return [];
  return Object.entries(decoded.value.payload).map(([key, value]) => ({
    key,
    value,
    description: CLAIM_DESCRIPTIONS[key] || null,
    isTime: isTimeClaim(key) && typeof value === 'number',
  }));
});

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function timeMeta(claim) {
  const abs = formatTimestamp(claim.value);
  const rel = relativeTime(claim.value, props.now);
  return { abs, rel };
}

// exp in the past / nbf in the future => flag.
function timeState(claim) {
  const ms = claim.value * 1000;
  if (claim.key === 'exp') return ms < props.now ? 'expired' : 'ok';
  if (claim.key === 'nbf') return ms > props.now ? 'notyet' : 'ok';
  return 'neutral';
}

function activateTab(tab, focus = false) {
  activeTab.value = tab;
  if (focus) {
    requestAnimationFrame(() => document.getElementById(`${tab}-token-tab`)?.focus());
  }
}

function onTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'raw' : 'decoded';
  activateTab(next, true);
}
</script>

<template>
  <div class="card decoded">
    <div class="tabs" role="tablist" aria-label="Decoded token views" @keydown="onTabKeydown">
      <button
        id="raw-token-tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'raw'"
        aria-controls="raw-token-panel"
        :tabindex="activeTab === 'raw' ? 0 : -1"
        @click="activateTab('raw')"
      >
        Raw decoded payload
      </button>
      <button
        id="decoded-token-tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === 'decoded'"
        aria-controls="decoded-token-panel"
        :tabindex="activeTab === 'decoded' ? 0 : -1"
        @click="activateTab('decoded')"
      >
        Decoded token
      </button>
    </div>

    <div
      v-if="activeTab === 'decoded'"
      id="decoded-token-panel"
      class="tab-panel"
      role="tabpanel"
      aria-labelledby="decoded-token-tab"
    >
      <p class="tab-description">
        Claims parsed from the access token.
        <span class="warn">Signature is not verified.</span>
      </p>

      <!-- Opaque / non-JWT token -->
      <div v-if="!decoded" class="empty">
        <div class="empty-icon">🔒</div>
        <p class="empty-title">This access token isn't a JWT</p>
        <p class="empty-sub">
          It looks like an opaque token, so there are no readable claims. Introspect it at the
          provider's token-introspection endpoint instead.
        </p>
      </div>

      <template v-else>
        <!-- Header -->
        <section class="section">
          <div class="section-head">
            <h3>Header</h3>
            <CopyButton :value="decoded.header" label="Copy" />
          </div>
          <div class="kv-list">
            <div v-for="(val, key) in decoded.header" :key="key" class="kv">
              <div class="kv-key">
                <code>{{ key }}</code>
                <span v-if="CLAIM_DESCRIPTIONS[key]" class="desc">
                  {{ CLAIM_DESCRIPTIONS[key] }}
                </span>
              </div>
              <div class="kv-val">{{ displayValue(val) }}</div>
            </div>
          </div>
        </section>

        <!-- Payload / claims -->
        <section class="section">
          <div class="section-head">
            <h3>Payload · {{ claims.length }} claims</h3>
            <CopyButton :value="decoded.payload" label="Copy" />
          </div>
          <div class="kv-list">
            <div v-for="claim in claims" :key="claim.key" class="kv">
              <div class="kv-key">
                <code>{{ claim.key }}</code>
                <span v-if="claim.description" class="desc">{{ claim.description }}</span>
              </div>
              <div class="kv-val">
                <template v-if="claim.isTime">
                  <span class="mono">{{ claim.value }}</span>
                  <span class="time-detail">
                    {{ timeMeta(claim).abs }}
                    <span
                      class="time-rel"
                      :class="{
                        bad: timeState(claim) === 'expired' || timeState(claim) === 'notyet',
                        good: timeState(claim) === 'ok',
                      }"
                      >({{ timeMeta(claim).rel }})</span
                    >
                  </span>
                </template>
                <span v-else>{{ displayValue(claim.value) }}</span>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>

    <div
      v-else
      id="raw-token-panel"
      class="tab-panel raw-panel"
      role="tabpanel"
      aria-labelledby="raw-token-tab"
    >
      <div class="raw-head">
        <p class="tab-description">
          Unformatted claims parsed from the access token.
          <span class="warn">Signature is not verified.</span>
        </p>
        <CopyButton v-if="decoded" :value="decoded.payload" label="Copy JSON" />
      </div>
      <div v-if="!decoded" class="empty">
        <div class="empty-icon">🔒</div>
        <p class="empty-title">No decoded payload is available</p>
        <p class="empty-sub">Opaque access tokens do not contain readable JWT claims.</p>
      </div>
      <pre v-else data-testid="raw-decoded-payload">{{ JSON.stringify(decoded.payload, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.decoded {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
}
.tabs button {
  position: relative;
  padding: 8px 12px 11px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.tabs button::after {
  content: '';
  position: absolute;
  right: 10px;
  bottom: -1px;
  left: 10px;
  height: 2px;
  background: transparent;
  border-radius: 999px;
}
.tabs button:hover {
  color: var(--text);
}
.tabs button[aria-selected='true'] {
  color: var(--accent);
}
.tabs button[aria-selected='true']::after {
  background: var(--accent);
}
.tabs button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 6px;
}
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tab-description {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.warn {
  color: var(--warning);
  font-weight: 600;
}
.empty {
  text-align: center;
  padding: 24px 16px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.empty-icon {
  font-size: 30px;
}
.empty-title {
  margin: 8px 0 4px;
  font-weight: 600;
}
.empty-sub {
  margin: 0 auto;
  max-width: 380px;
  font-size: 13px;
  color: var(--text-muted);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.section-head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.kv-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.kv {
  display: grid;
  grid-template-columns: minmax(140px, 210px) 1fr;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.kv:nth-child(even) {
  background: var(--surface-2);
}
.kv:last-child {
  border-bottom: none;
}
.kv-key {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.kv-key code {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}
.desc {
  font-size: 11.5px;
  color: var(--text-faint);
}
.kv-val {
  font-size: 13.5px;
  word-break: break-word;
  align-self: center;
}
.mono {
  font-family: var(--font-mono);
  font-weight: 600;
}
.time-detail {
  display: block;
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 2px;
}
.time-rel.good {
  color: var(--success);
  font-weight: 600;
}
.time-rel.bad {
  color: var(--danger);
  font-weight: 600;
}
.raw-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.raw-panel pre {
  margin: 0;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: auto;
  max-height: 320px;
}
@media (max-width: 560px) {
  .tabs {
    overflow-x: auto;
  }
  .tabs button {
    white-space: nowrap;
  }
  .kv {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
