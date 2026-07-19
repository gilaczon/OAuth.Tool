<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import CopyButton from './CopyButton.vue';
import { relativeTime } from '../lib/jwt.js';

const props = defineProps({
  token: { type: Object, required: true }, // the token endpoint JSON response
  requestedAt: { type: String, default: null }, // ISO string
});

// Live clock so the expiry countdown updates.
const now = ref(Date.now());
let timer = null;
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(timer));

const KNOWN = ['access_token', 'token_type', 'expires_in', 'scope', 'refresh_token', 'id_token'];

const accessToken = computed(() => props.token.access_token || '');
const revealed = reactive({
  access: false,
  refresh: false,
  id: false,
  raw: false,
});

function resetRevealed() {
  revealed.access = false;
  revealed.refresh = false;
  revealed.id = false;
  revealed.raw = false;
}

watch(() => props.token, resetRevealed);

const expiresAtMs = computed(() => {
  const secs = Number(props.token.expires_in);
  if (!Number.isFinite(secs) || !props.requestedAt) return null;
  const base = new Date(props.requestedAt).getTime();
  if (Number.isNaN(base)) return null;
  return base + secs * 1000;
});

const expiresLabel = computed(() => {
  if (!expiresAtMs.value) return null;
  return relativeTime(expiresAtMs.value / 1000, now.value);
});

const isExpired = computed(() => expiresAtMs.value != null && now.value >= expiresAtMs.value);

const expiresInText = computed(() => {
  const secs = Number(props.token.expires_in);
  if (!Number.isFinite(secs)) return null;
  const s = Math.floor(secs % 60);
  const m = Math.floor((secs / 60) % 60);
  const h = Math.floor(secs / 3600);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || !parts.length) parts.push(`${s}s`);
  return `${secs}s (${parts.join(' ')})`;
});

// Any additional fields the endpoint returned beyond the well-known ones.
const extraFields = computed(() =>
  Object.entries(props.token).filter(([k]) => !KNOWN.includes(k)),
);

function shortToken(t) {
  if (!t) return '';
  if (t.length <= 88) return t;
  return `${t.slice(0, 44)}…${t.slice(-24)}`;
}

function displayToken(token, key) {
  if (!revealed[key]) return '••••••••••••••••••••••••';
  return key === 'access' ? token : shortToken(token);
}
</script>

<template>
  <div class="card result">
    <div class="card-head row">
      <div>
        <h2>Token</h2>
        <p class="sub">Response from the token endpoint</p>
      </div>
      <span
        v-if="expiresAtMs"
        class="badge"
        :class="isExpired ? 'badge-danger' : 'badge-success'"
      >
        {{ isExpired ? 'Expired' : 'Active' }} · {{ expiresLabel }}
      </span>
    </div>

    <!-- Access token -->
    <div class="token-block">
      <div class="token-block-head">
        <span class="k">access_token</span>
        <div class="token-actions">
          <button
            type="button"
            class="reveal-btn"
            :aria-label="`${revealed.access ? 'Hide' : 'Reveal'} access token`"
            @click="revealed.access = !revealed.access"
          >
            {{ revealed.access ? 'Hide' : 'Reveal' }}
          </button>
          <CopyButton :value="accessToken" />
        </div>
      </div>
      <code class="token-value" data-testid="access-token-value">
        {{ displayToken(accessToken, 'access') }}
      </code>
    </div>

    <!-- Properties grid -->
    <div class="props">
      <div v-if="token.token_type" class="prop">
        <span class="k">token_type</span>
        <span class="v">{{ token.token_type }}</span>
      </div>
      <div v-if="expiresInText" class="prop">
        <span class="k">expires_in</span>
        <span class="v">{{ expiresInText }}</span>
      </div>
      <div v-if="token.scope" class="prop wide">
        <span class="k">scope</span>
        <span class="v scopes">
          <span v-for="s in String(token.scope).split(/\s+/)" :key="s" class="chip">{{ s }}</span>
        </span>
      </div>
      <div v-for="[k, val] in extraFields" :key="k" class="prop">
        <span class="k">{{ k }}</span>
        <span class="v">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
      </div>
    </div>

    <!-- Secondary tokens -->
    <div v-if="token.refresh_token" class="token-block">
      <div class="token-block-head">
        <span class="k">refresh_token</span>
        <div class="token-actions">
          <button
            type="button"
            class="reveal-btn"
            :aria-label="`${revealed.refresh ? 'Hide' : 'Reveal'} refresh token`"
            @click="revealed.refresh = !revealed.refresh"
          >
            {{ revealed.refresh ? 'Hide' : 'Reveal' }}
          </button>
          <CopyButton :value="token.refresh_token" />
        </div>
      </div>
      <code class="token-value muted">{{ displayToken(token.refresh_token, 'refresh') }}</code>
    </div>
    <div v-if="token.id_token" class="token-block">
      <div class="token-block-head">
        <span class="k">id_token</span>
        <div class="token-actions">
          <button
            type="button"
            class="reveal-btn"
            :aria-label="`${revealed.id ? 'Hide' : 'Reveal'} ID token`"
            @click="revealed.id = !revealed.id"
          >
            {{ revealed.id ? 'Hide' : 'Reveal' }}
          </button>
          <CopyButton :value="token.id_token" />
        </div>
      </div>
      <code class="token-value muted">{{ displayToken(token.id_token, 'id') }}</code>
    </div>

    <button
      type="button"
      class="raw-toggle"
      :aria-expanded="revealed.raw"
      @click="revealed.raw = !revealed.raw"
    >
      {{ revealed.raw ? 'Hide' : 'Reveal' }} raw JSON response
    </button>
    <details v-if="revealed.raw" class="raw" open>
      <summary>
        Raw JSON response
        <CopyButton :value="token" label="Copy JSON" @click.stop />
      </summary>
      <pre>{{ JSON.stringify(token, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-head.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.card-head h2 {
  margin: 0;
  font-size: 18px;
}
.card-head .sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
.badge {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}
.badge-success {
  color: var(--success);
  background: var(--success-soft);
  border: 1px solid var(--success);
}
.badge-danger {
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
}
.token-block {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--code-bg);
  overflow: hidden;
}
.token-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
.token-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.reveal-btn,
.raw-toggle {
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.reveal-btn:hover,
.raw-toggle:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}
.raw-toggle {
  width: fit-content;
}
.token-value {
  display: block;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--text);
  word-break: break-all;
  white-space: pre-wrap;
  max-height: 220px;
  overflow: auto;
}
.token-value.muted {
  color: var(--text-muted);
}
.props {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 8px;
}
.prop {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 8px 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.prop.wide {
  grid-column: 1 / -1;
  align-items: flex-start;
}
.k {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}
.v {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  word-break: break-word;
}
.scopes {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 8px;
}
.raw summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 6px 0;
  list-style: none;
}
.raw summary::-webkit-details-marker {
  display: none;
}
.raw pre {
  margin: 8px 0 0;
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
  .props {
    grid-template-columns: 1fr;
  }
}
</style>
