import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_KEYS = new Set([
  'your_gemini_api_key_here',
  'your_api_key_here',
  'your-api-key-here',
  'changeme',
  'replace_me',
  'insert_key_here',
  'paste_your_api_key_here',
]);

export function isPlaceholderKey(raw) {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return false;
  if (PLACEHOLDER_KEYS.has(trimmed)) return true;
  if (/^<.*>$/.test(trimmed)) return true;
  if (/^(your|replace|paste|insert)[_-].*key/.test(trimmed)) return true;
  return false;
}

export function parseEnvContent(content) {
  const result = {};
  if (typeof content !== 'string' || !content.trim()) {
    return result;
  }

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const line = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let rawVal = line.slice(eqIndex + 1).trim();
    if (!rawVal) {
      result[key] = '';
      continue;
    }

    const quote = rawVal[0];
    if ((quote === '"' || quote === "'") && rawVal.length >= 2) {
      let endIdx = -1;
      for (let i = 1; i < rawVal.length; i++) {
        if (rawVal[i] === quote && rawVal[i - 1] !== '\\') {
          endIdx = i;
          break;
        }
      }
      if (endIdx !== -1) {
        let inner = rawVal.slice(1, endIdx);
        if (quote === '"') {
          inner = inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        result[key] = inner;
        continue;
      }
    }

    // Unquoted value: strip inline comment preceded by whitespace
    const commentMatch = rawVal.match(/\s+#/);
    if (commentMatch) {
      rawVal = rawVal.slice(0, commentMatch.index).trim();
    }
    result[key] = rawVal;
  }
  return result;
}

export function loadEnvFile(envPath = path.resolve(process.cwd(), '.env'), targetEnv = process.env) {
  if (!fs.existsSync(envPath)) {
    return { loaded: false, path: envPath, keys: [] };
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const parsed = parseEnvContent(content);
  const loadedKeys = [];
  for (const [k, v] of Object.entries(parsed)) {
    if (targetEnv[k] === undefined || targetEnv[k] === '') {
      targetEnv[k] = v;
      loadedKeys.push(k);
    }
  }
  return { loaded: true, path: envPath, keys: loadedKeys };
}

export function normalizeApiKey(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (isPlaceholderKey(trimmed)) return '';
  return trimmed;
}

export function getConfig({ env = process.env, envPath } = {}) {
  if (envPath) {
    loadEnvFile(envPath, env);
  }

  const candidates = [
    ['API_KEY', env.API_KEY],
    ['GEMINI_API_KEY', env.GEMINI_API_KEY],
    ['GOOGLE_API_KEY', env.GOOGLE_API_KEY],
  ];

  let apiKey = '';
  let envVarUsed = null;
  let placeholderDetected = false;

  for (const [name, val] of candidates) {
    if (isPlaceholderKey(val)) {
      placeholderDetected = true;
    }
    const clean = normalizeApiKey(val);
    if (clean) {
      apiKey = clean;
      envVarUsed = name;
      break;
    }
  }

  const model = (env.GEMINI_MODEL || 'gemini-3.5-flash').trim() || 'gemini-3.5-flash';
  const parsedPort = Number.parseInt(env.PORT || '3000', 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3000;
  const rawProvider = String(env.GEMINI_PROVIDER || 'auto').trim().toLowerCase();
  const explicitProvider =
    rawProvider === 'vertex-express' || rawProvider === 'gemini-developer' ? rawProvider : null;
  const apiKeyProvider = apiKey
    ? explicitProvider || (apiKey.startsWith('AQ.') ? 'auto' : 'gemini-developer')
    : null;

  return {
    apiKey,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyProvider,
    envVarUsed,
    placeholderDetected,
    model,
    port,
  };
}
