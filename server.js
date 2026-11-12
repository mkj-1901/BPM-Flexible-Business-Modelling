import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeProcess } from './src/engine.js';
import { getConfig, loadEnvFile } from './src/env.js';
import { generateSpecWithGemini } from './src/gemini.js';
import { parsePromptLocally } from './src/localParser.js';
import { getPresetById, listPresets } from './src/presets.js';
import { buildZipBuffer } from './src/zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseRawJson(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const err = new Error('Invalid JSON request body.');
    err.statusCode = 400;
    throw err;
  }
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
  // Vercel and some serverless adapters pre-parse req.body before invoking the handler.
  if (req.body !== undefined) {
    if (req.body === null || req.body === '') return Promise.resolve({});
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length > maxBytes) {
        const err = new Error('Request payload exceeds maximum allowed size.');
        err.statusCode = 413;
        return Promise.reject(err);
      }
      return Promise.resolve(parseRawJson(req.body.toString('utf8')));
    }
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > maxBytes) {
        const err = new Error('Request payload exceeds maximum allowed size.');
        err.statusCode = 413;
        return Promise.reject(err);
      }
      return Promise.resolve(parseRawJson(req.body));
    }
    if (typeof req.body === 'object') {
      return Promise.resolve(req.body);
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        const err = new Error('Request payload exceeds maximum allowed size.');
        err.statusCode = 413;
        req.resume(); // drain cleanly so HTTP 413 response can flush
        reject(err);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(parseRawJson(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

function sanitizeArchiveFileName(name) {
  const base = path.basename(String(name || 'file.txt')).replace(/[^A-Za-z0-9._-]/g, '_');
  return base || 'file.txt';
}

export function createRequestHandler({
  publicDir = DEFAULT_PUBLIC_DIR,
  env = process.env,
  envPath = path.resolve(__dirname, '.env'),
  loadDotEnv = true,
  geminiGenerator = generateSpecWithGemini,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (loadDotEnv) {
    loadEnvFile(envPath, env);
  }

  const resolvedPublicDir = path.resolve(publicDir);

  return async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      let pathname;
      try {
        pathname = decodeURIComponent(urlObj.pathname);
      } catch {
        sendJson(res, 400, { error: 'Malformed URL path encoding.' });
        return;
      }

      // API Routes
      if (req.method === 'GET' && pathname === '/api/health') {
        const cfg = getConfig({ env });
        sendJson(res, 200, {
          ok: true,
          apiKeyConfigured: cfg.apiKeyConfigured,
          apiKeyProvider: cfg.apiKeyProvider,
          placeholderDetected: cfg.placeholderDetected,
          envVarUsed: cfg.envVarUsed,
          model: cfg.model,
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/presets') {
        sendJson(res, 200, { presets: listPresets() });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/generate') {
        const body = await readJsonBody(req);
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        const mode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 'auto';
        const presetId = typeof body.presetId === 'string' ? body.presetId.trim() : '';

        if (!['auto', 'gemini', 'local', 'reference'].includes(mode)) {
          sendJson(res, 400, { error: `Unsupported generation mode "${mode}".` });
          return;
        }

        if (mode === 'reference') {
          const preset = getPresetById(presetId);
          if (!preset?.referenceSpec) {
            sendJson(res, 404, { error: 'Reference specification not found for this preset.' });
            return;
          }
          const result = analyzeProcess(preset.referenceSpec);
          sendJson(res, 200, {
            ...result,
            engineUsed: 'reference',
            model: null,
            notice: 'Loaded canonical repository reference model.',
          });
          return;
        }

        if (!prompt) {
          sendJson(res, 400, {
            error: 'Please enter a natural-language process prompt before generating.',
          });
          return;
        }

        if (prompt.length > 15000) {
          sendJson(res, 400, {
            error: 'Prompt is too long (maximum 15,000 characters).',
          });
          return;
        }

        const cfg = getConfig({ env });

        if (mode === 'gemini' && !cfg.apiKeyConfigured) {
          sendJson(res, 400, {
            error: cfg.placeholderDetected
              ? 'API_KEY in .env still has a placeholder value. Replace it with your Gemini API key, or switch to Local Parser mode.'
              : 'API_KEY is not set in .env. Add API_KEY=<your_gemini_key> to .env (ignored by .gitignore), or switch to Local Parser mode.',
          });
          return;
        }

        const useGemini = mode === 'gemini' || (mode === 'auto' && cfg.apiKeyConfigured);

        let rawSpec;
        let engineUsed;
        let modelUsed = null;
        let providerUsed = null;
        let usageMetadata = null;
        let notice = null;

        if (useGemini) {
          const llmResult = await geminiGenerator({
            prompt,
            apiKey: cfg.apiKey,
            model: cfg.model,
            provider: cfg.apiKeyProvider || 'auto',
            fetchImpl,
          });
          rawSpec = llmResult.rawSpec;
          engineUsed = 'gemini';
          modelUsed = llmResult.model;
          providerUsed = llmResult.provider || cfg.apiKeyProvider;
          usageMetadata = llmResult.usageMetadata || null;
        } else {
          rawSpec = parsePromptLocally(prompt);
          engineUsed = 'local';
          notice =
            mode === 'auto'
              ? 'No Gemini API_KEY configured in .env — generated locally with the rule-based BPM parser.'
              : 'Generated using the local rule-based BPM parser.';
        }

        const result = analyzeProcess(rawSpec);
        sendJson(res, 200, {
          ...result,
          engineUsed,
          model: modelUsed,
          provider: providerUsed,
          usageMetadata,
          notice,
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/export-zip') {
        const body = await readJsonBody(req, 4 * 1024 * 1024);
        let entries = [];
        let archiveBase = 'BPM_Flexible_Bundle';

        if (Array.isArray(body.files) && body.files.length > 0) {
          entries = body.files.slice(0, 32).map((f) => ({
            name: sanitizeArchiveFileName(f?.name),
            content: String(f?.content ?? ''),
          }));
          if (body.archiveName) {
            archiveBase = sanitizeArchiveFileName(body.archiveName).replace(/\.zip$/i, '');
          }
        } else if (body.spec) {
          const analysis = analyzeProcess(body.spec);
          archiveBase = `${analysis.spec.slug}_BPM_Bundle`;
          entries = [
            { name: analysis.files.comparisonFileName, content: analysis.files.comparisonMd },
            { name: analysis.files.flexibleBpmn.fileName, content: analysis.files.flexibleBpmn.xml },
            ...analysis.files.rigidBpmns.map((rf) => ({ name: rf.fileName, content: rf.xml })),
          ];
        } else {
          sendJson(res, 400, { error: 'Provide either "files" array or "spec" to export ZIP.' });
          return;
        }

        const zipBuffer = buildZipBuffer(entries);
        const fileName = `${archiveBase}.zip`;
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': zipBuffer.length,
          'Cache-Control': 'no-store',
        });
        res.end(zipBuffer);
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: 'API endpoint not found.' });
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendJson(res, 405, { error: 'Method not allowed.' });
        return;
      }

      // Static File Serving with strict path traversal protection
      const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const targetPath = path.resolve(resolvedPublicDir, relPath);

      if (
        targetPath !== resolvedPublicDir &&
        !targetPath.startsWith(resolvedPublicDir + path.sep)
      ) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(targetPath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(targetPath);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': content.length,
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(content);
      }
    } catch (err) {
      const status = err?.statusCode || 500;
      sendJson(res, status, { error: err?.message || 'Internal server error.' });
    }
  };
}

export function createAppServer(options = {}) {
  return http.createServer(createRequestHandler(options));
}

// Run server only when executed directly
const isMainModule =
  Boolean(process.argv[1]) &&
  (process.platform === 'win32'
    ? path.resolve(process.argv[1]).toLowerCase() === __filename.toLowerCase()
    : path.resolve(process.argv[1]) === __filename);

if (isMainModule) {
  loadEnvFile(path.resolve(__dirname, '.env'), process.env);
  const cfg = getConfig({ env: process.env });
  const server = createAppServer({ loadDotEnv: false });

  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      console.error(
        `Port ${cfg.port} is already in use. Set a different PORT (e.g., PORT=3001) in .env and try again.`,
      );
      process.exit(1);
    }
    throw err;
  });

  server.listen(cfg.port, () => {
    const keyStatus = cfg.apiKeyConfigured
      ? `configured (${cfg.envVarUsed}, provider=${cfg.apiKeyProvider}, model=${cfg.model})`
      : 'NOT configured (using Local Rule-Based Parser fallback unless API_KEY is set in .env)';
    console.log(`BPM Flexible Modelling Studio listening at http://localhost:${cfg.port}`);
    console.log(`Gemini API key status: ${keyStatus}`);
  });
}
