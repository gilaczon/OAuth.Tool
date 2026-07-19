<script setup>
import { reactive, ref, watch } from 'vue';
import {
  DEFAULT_TOKEN_URL,
  DEFAULT_GRANT_TYPE,
  DEFAULT_SCOPE,
  DEFAULT_AUTH_STYLE,
} from '../config.js';

const props = defineProps({
  loading: { type: Boolean, default: false },
});
const emit = defineEmits(['submit']);

const STORAGE_KEY = 'oauth2-tool-form';

const form = reactive({
  tokenUrl: DEFAULT_TOKEN_URL,
  grantType: DEFAULT_GRANT_TYPE,
  clientId: '',
  clientSecret: '',
  scope: DEFAULT_SCOPE,
  authStyle: DEFAULT_AUTH_STYLE,
});

// Restore previously entered non-secret fields (secret is never persisted).
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved) {
    form.tokenUrl = saved.tokenUrl ?? form.tokenUrl;
    form.grantType = saved.grantType ?? form.grantType;
    form.clientId = saved.clientId ?? form.clientId;
    form.scope = saved.scope ?? form.scope;
    form.authStyle = saved.authStyle ?? form.authStyle;
  }
} catch {
  /* ignore */
}

const rememberClientId = ref(true);
const showSecret = ref(false);

watch(
  form,
  (v) => {
    const toSave = {
      tokenUrl: v.tokenUrl,
      grantType: v.grantType,
      scope: v.scope,
      authStyle: v.authStyle,
      clientId: rememberClientId.value ? v.clientId : '',
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      /* ignore */
    }
  },
  { deep: true },
);

function onSubmit() {
  emit('submit', { ...form });
}
</script>

<template>
  <form class="card form" @submit.prevent="onSubmit">
    <div class="card-head">
      <h2>Request a token</h2>
      <p class="sub">Client credentials grant</p>
    </div>

    <div class="field">
      <label for="tokenUrl">Token endpoint (OAuth2 URL)</label>
      <input
        id="tokenUrl"
        v-model.trim="form.tokenUrl"
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="https://issuer.example.com/oauth2/token"
        required
      />
    </div>

    <div class="field">
      <label for="grantType">Grant type</label>
      <input id="grantType" v-model.trim="form.grantType" type="text" spellcheck="false" />
      <span class="hint">Defaulted to <code>client_credentials</code>.</span>
    </div>

    <div class="field">
      <label for="clientId">Client ID</label>
      <input
        id="clientId"
        v-model.trim="form.clientId"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="your-client-id"
        required
      />
    </div>

    <div class="field">
      <label for="clientSecret">Client secret</label>
      <div class="input-affix">
        <input
          id="clientSecret"
          v-model="form.clientSecret"
          :type="showSecret ? 'text' : 'password'"
          autocomplete="off"
          spellcheck="false"
          placeholder="your-client-secret"
          required
        />
        <button
          type="button"
          class="affix-btn"
          :title="showSecret ? 'Hide secret' : 'Show secret'"
          @click="showSecret = !showSecret"
        >
          {{ showSecret ? 'Hide' : 'Show' }}
        </button>
      </div>
    </div>

    <div class="field">
      <label for="scope">Scope <span class="optional">optional</span></label>
      <input
        id="scope"
        v-model.trim="form.scope"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="api.read api.write"
      />
      <span class="hint">Space-separated if more than one.</span>
    </div>

    <div class="field">
      <label>Client authentication</label>
      <div class="segmented">
        <button
          type="button"
          :class="{ active: form.authStyle === 'body' }"
          @click="form.authStyle = 'body'"
        >
          Request body
        </button>
        <button
          type="button"
          :class="{ active: form.authStyle === 'basic' }"
          @click="form.authStyle = 'basic'"
        >
          Basic header
        </button>
      </div>
      <span class="hint">
        How <code>client_id</code>/<code>client_secret</code> are sent. Try the other if you
        get <code>invalid_client</code>.
      </span>
    </div>

    <label class="check">
      <input v-model="rememberClientId" type="checkbox" />
      <span>Remember client ID (the secret is never saved)</span>
    </label>

    <button class="submit" type="submit" :disabled="loading">
      <span v-if="!loading">Request Token</span>
      <span v-else class="loading-inline">
        <span class="spinner" aria-hidden="true"></span> Requesting…
      </span>
    </button>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-head h2 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.01em;
}
.card-head .sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.optional {
  font-weight: 500;
  color: var(--text-faint);
  font-size: 12px;
}
input[type='text'],
input[type='url'],
input[type='password'] {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-affix {
  position: relative;
  display: flex;
  align-items: center;
}
.input-affix input {
  padding-right: 64px;
}
.affix-btn {
  position: absolute;
  right: 6px;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}
.affix-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}
.hint {
  font-size: 12px;
  color: var(--text-faint);
}
.hint code,
label code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 4px;
}
.segmented {
  display: inline-flex;
  padding: 3px;
  gap: 3px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  width: fit-content;
}
.segmented button {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.segmented button.active {
  color: #fff;
  background: var(--accent);
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
}
.check input {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
  cursor: pointer;
}
.submit {
  margin-top: 4px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.05s ease;
}
.submit:hover:not(:disabled) {
  background: var(--accent-hover);
}
.submit:active:not(:disabled) {
  transform: translateY(1px);
}
.submit:disabled {
  opacity: 0.7;
  cursor: default;
}
.loading-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
