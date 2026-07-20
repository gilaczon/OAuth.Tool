<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import TokenForm from './components/TokenForm.vue';
import TokenResult from './components/TokenResult.vue';
import DecodedToken from './components/DecodedToken.vue';
import { AUTO_CLEAR_SENSITIVE_DATA_MS } from './config.js';
import { apiFetch, SessionExpiredError } from './lib/api.js';

// ---- Theme (auto / light / dark) --------------------------------------------
const THEME_KEY = 'oauth2-tool-theme';
const theme = ref(localStorage.getItem(THEME_KEY) || 'auto'); // 'auto' | 'light' | 'dark'

function applyTheme() {
  const root = document.documentElement;
  if (theme.value === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme.value);
}
function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  theme.value = order[(order.indexOf(theme.value) + 1) % order.length];
  localStorage.setItem(THEME_KEY, theme.value);
  applyTheme();
}
applyTheme();

const themeIcon = computed(() => ({ auto: '🌗', light: '☀️', dark: '🌙' }[theme.value]));
const themeLabel = computed(
  () => ({ auto: 'Auto', light: 'Light', dark: 'Dark' }[theme.value]),
);

// ---- Live clock for the decoded-token relative times ------------------------
const now = ref(Date.now());
let clock = null;
let sensitiveDataTimer = null;
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => {
  clearInterval(clock);
  clearTimeout(sensitiveDataTimer);
});

// ---- Token request ----------------------------------------------------------
const loading = ref(false);
const error = ref(null);
const result = ref(null); // { data, status, requestedAt }
const tokenForm = ref(null);
const autoClearMinutes = Math.round(AUTO_CLEAR_SENSITIVE_DATA_MS / 60_000);

function clearSensitiveData() {
  clearTimeout(sensitiveDataTimer);
  sensitiveDataTimer = null;
  tokenForm.value?.clearCredentials();
  error.value = null;
  result.value = null;
}

function scheduleSensitiveDataClear() {
  clearTimeout(sensitiveDataTimer);
  if (AUTO_CLEAR_SENSITIVE_DATA_MS <= 0) return;
  sensitiveDataTimer = setTimeout(clearSensitiveData, AUTO_CLEAR_SENSITIVE_DATA_MS);
}

async function requestToken(form) {
  scheduleSensitiveDataClear();
  loading.value = true;
  error.value = null;
  result.value = null;
  try {
    const resp = await apiFetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const payload = await resp.json();

    if (payload.error && payload.status === undefined) {
      // Proxy-level failure (couldn't reach endpoint, bad input, etc.)
      throw new Error(payload.message || payload.error);
    }
    if (!payload.ok) {
      // Token endpoint responded but with an OAuth error.
      const d = payload.data || {};
      const detail = d.error_description || d.error || JSON.stringify(d);
      error.value = {
        title: `Token endpoint returned ${payload.status}`,
        detail,
        data: d,
      };
      return;
    }
    result.value = { data: payload.data, status: payload.status, requestedAt: payload.requestedAt };
  } catch (e) {
    error.value =
      e instanceof SessionExpiredError
        ? { title: 'Session expired', detail: e.message }
        : { title: 'Request failed', detail: String(e.message || e) };
  } finally {
    loading.value = false;
  }
}

const accessToken = computed(() => result.value?.data?.access_token || '');
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <span class="logo">🔑</span>
        <div>
          <h1>OAuth2 Client Credentials</h1>
          <p>Request a token and inspect its claims</p>
        </div>
      </div>
      <button class="theme-toggle" :title="`Theme: ${themeLabel}`" @click="cycleTheme">
        <span class="theme-emoji">{{ themeIcon }}</span>
        <span class="theme-text">{{ themeLabel }}</span>
      </button>
    </header>

    <main class="layout">
      <section class="col-form">
        <TokenForm
          ref="tokenForm"
          :loading="loading"
          @submit="requestToken"
          @clear="clearSensitiveData"
        />
      </section>

      <section class="col-result">
        <!-- Error -->
        <div v-if="error" class="card error-card">
          <div class="error-head">
            <span class="error-dot"></span>
            <h2>{{ error.title }}</h2>
          </div>
          <p class="error-detail">{{ error.detail }}</p>
          <details v-if="error.data" class="raw">
            <summary>Error response</summary>
            <pre>{{ JSON.stringify(error.data, null, 2) }}</pre>
          </details>
        </div>

        <!-- Results -->
        <template v-if="result">
          <TokenResult :token="result.data" :requested-at="result.requestedAt" />
          <DecodedToken :access-token="accessToken" :now="now" />
        </template>

        <!-- Empty state -->
        <div v-if="!result && !error && !loading" class="card placeholder">
          <div class="ph-icon">🎟️</div>
          <h2>No token yet</h2>
          <p>
            Fill in the form and press <strong>Request Token</strong>. The token, its
            properties, and every decoded claim will show up here.
          </p>
        </div>

        <!-- Loading skeleton -->
        <div v-if="loading" class="card placeholder">
          <div class="ph-spinner"></div>
          <h2>Requesting token…</h2>
          <p>Talking to the token endpoint through the local proxy.</p>
        </div>
      </section>
    </main>

    <footer class="foot">
      <span>
        Requests are proxied server-side to avoid CORS. Typed credentials are never
        stored; saved profiles keep their secrets on the server and are referenced by
        name only.
        <template v-if="AUTO_CLEAR_SENSITIVE_DATA_MS > 0">
          Sensitive data clears after {{ autoClearMinutes }} minutes.
        </template>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.app {
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px 20px 40px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}
.logo {
  font-size: 30px;
  line-height: 1;
  filter: drop-shadow(0 2px 6px rgba(79, 70, 229, 0.3));
}
.brand h1 {
  margin: 0;
  font-size: 21px;
  letter-spacing: -0.02em;
}
.brand p {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: border-color 0.15s ease;
}
.theme-toggle:hover {
  border-color: var(--accent);
}
.theme-emoji {
  font-size: 15px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(320px, 400px) 1fr;
  gap: 20px;
  align-items: start;
}
.col-result {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}
.placeholder {
  text-align: center;
  padding: 56px 24px;
}
.ph-icon {
  font-size: 40px;
}
.placeholder h2 {
  margin: 12px 0 6px;
  font-size: 18px;
}
.placeholder p {
  margin: 0 auto;
  max-width: 380px;
  font-size: 14px;
  color: var(--text-muted);
}
.ph-spinner {
  width: 34px;
  height: 34px;
  margin: 0 auto;
  border: 3px solid var(--border-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.error-card {
  border-color: var(--danger);
}
.error-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.error-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 0 4px var(--danger-soft);
}
.error-head h2 {
  margin: 0;
  font-size: 16px;
  color: var(--danger);
}
.error-detail {
  margin: 10px 0 0;
  font-size: 14px;
  color: var(--text);
  word-break: break-word;
}
.raw summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 8px 0 4px;
}
.raw pre {
  margin: 6px 0 0;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: auto;
  max-height: 280px;
}
.foot {
  margin-top: 28px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-faint);
}
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
