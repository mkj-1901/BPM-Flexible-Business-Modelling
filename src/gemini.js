// Gemini API client for converting natural-language business process prompts
// into a structured Rigid-vs-Flexible BPM ProcessSpec.

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    processName: { type: 'STRING' },
    overview: { type: 'STRING' },
    stages: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          name: { type: 'STRING' },
          defaultBranch: { type: 'STRING' },
          bypassLabel: { type: 'STRING' },
          activities: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                name: { type: 'STRING' },
                branchLabel: { type: 'STRING' },
              },
              required: ['id', 'name'],
            },
          },
        },
        required: ['id', 'name', 'activities'],
      },
    },
    variants: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          code: { type: 'STRING' },
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          choices: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                stageId: { type: 'STRING' },
                choice: { type: 'STRING' },
              },
              required: ['stageId', 'choice'],
            },
          },
        },
        required: ['code', 'name', 'choices'],
      },
    },
  },
  required: ['processName', 'overview', 'stages', 'variants'],
};

const SYSTEM_INSTRUCTION = `You are a Business Process Management (BPM) architect specializing in BPMN 2.0 "flexibility by selection" (consolidating multiple rigid BPMN process variants into a single unified flexible BPMN model using XOR gateways, FEEL guard expressions, and bypass flows).

Given a natural-language description of a business process and its activities (and optionally explicit variants), produce a clean, well-structured JSON ProcessSpec:

Rules:
1. "processName": Clear domain title (e.g., "Loan Application Process").
2. "overview": 1-2 sentences summarizing the process and its stages.
3. "stages": Ordered list of 3 to 9 sequential stages from start to end.
   - Each stage has a short alphanumeric XML-safe "id" (e.g., "Intake", "CreditCheck", "Archive"), a concise human "name" (use "?" for optional stages like "Archive?"), and "activities".
   - Shared mandatory stages have 1 activity executed by ALL variants.
   - Alternative stages have 2+ mutually exclusive activities fulfilling the same stage differently.
   - Optional stages have 1 activity executed by some variants and skipped ("SKIP") by others.
   - Hybrid stages have 2+ activities where at least one variant chooses "SKIP".
   - Keep activity names concise BPMN Verb-Noun labels (2-5 words, Title Case, e.g., "Receive Request", "Assess Manually").
   - Set "defaultBranch" on variation stages to either the most common activity id or "SKIP".
   - Give each alternative/optional activity a concise "branchLabel" (e.g., "Digital / Standard", "Legacy").
4. "variants": 2 to 6 distinct operational variants ("V1", "V2", ...).
   - If the user describes explicit variants, preserve all of them faithfully.
   - If the user describes a process with optional/alternative paths but does not name variants, construct 3-4 realistic operational variants (e.g., V1 Standard, V2 Fast-Track, V3 Legacy/Manual, V4 Exception/Rejected) that cover EVERY activity and optional skip in the stages.
   - For EVERY variant, "choices" MUST include one entry { "stageId": "<stage.id>", "choice": "<activity.id or SKIP>" } for EVERY stage in "stages".
   - Every activity listed in "stages" must be used by at least one variant, and each variant should represent a distinct execution path.`;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-flash-lite-latest'];

export function stripMarkdownCodeFence(text) {
  const trimmed = String(text || '').trim();
  const exactMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (exactMatch) return exactMatch[1].trim();
  const embeddedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return embeddedMatch ? embeddedMatch[1].trim() : trimmed;
}

export function resolveGeminiEndpoint({
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  endpoint = null,
  provider = 'auto',
} = {}) {
  const cleanModel =
    String(model || DEFAULT_GEMINI_MODEL)
      .trim()
      .replace(/^models\//i, '') || DEFAULT_GEMINI_MODEL;
  const trimmedKey = String(apiKey || '').trim();
  const normalizedProvider = String(provider || 'auto').trim().toLowerCase();

  if (endpoint && String(endpoint).trim()) {
    const resolvedProvider =
      normalizedProvider === 'vertex-express' || normalizedProvider === 'gemini-developer'
        ? normalizedProvider
        : String(endpoint).includes('aiplatform.googleapis.com')
        ? 'vertex-express'
        : 'gemini-developer';
    return {
      cleanModel,
      endpoint: String(endpoint).trim(),
      provider: resolvedProvider,
    };
  }

  const useVertexExpress = normalizedProvider === 'vertex-express';
  return {
    cleanModel,
    endpoint: useVertexExpress
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${encodeURIComponent(
          cleanModel,
        )}:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          cleanModel,
        )}:generateContent`,
    provider: useVertexExpress ? 'vertex-express' : 'gemini-developer',
  };
}

export async function generateSpecWithGemini({
  prompt,
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  endpoint = null,
  provider = 'auto',
  fetchImpl = globalThis.fetch,
  timeoutMs = 60000,
}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    const err = new Error('Prompt cannot be empty.');
    err.statusCode = 400;
    throw err;
  }
  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey) {
    const err = new Error('Gemini API key is not configured. Add API_KEY=<your_key> to .env.');
    err.statusCode = 400;
    throw err;
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch implementation is unavailable in this Node runtime.');
  }

  const normalizedProvider = String(provider || 'auto').trim().toLowerCase();
  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Convert the following process description into the structured Rigid-vs-Flexible BPM ProcessSpec JSON:\n\n${prompt.trim()}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  };

  const deadline = Date.now() + timeoutMs;

  async function attemptRequest({ targetModel, targetEndpoint, targetProvider }) {
    const remainingMs = Math.max(1000, deadline - Date.now());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);

    let response;
    try {
      response = await fetchImpl(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmedKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutErr = new Error(`Gemini API request timed out after ${timeoutMs}ms.`);
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      const netErr = new Error(`Failed to reach Gemini API: ${err?.message || 'Network error'}`);
      netErr.statusCode = 502;
      throw netErr;
    } finally {
      clearTimeout(timer);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const apiMessage = payload?.error?.message || `Gemini API returned HTTP ${response.status}`;
      const err = new Error(`Gemini API error (${response.status}): ${apiMessage}`);
      err.httpStatus = response.status;
      err.statusCode = response.status === 401 || response.status === 403 ? 401 : 502;
      throw err;
    }

    const parts = Array.isArray(payload?.candidates?.[0]?.content?.parts)
      ? payload.candidates[0].content.parts
      : [];
    const candidateText = parts
      .filter((p) => p && !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim();

    if (!candidateText) {
      const blockReason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason;
      const err = new Error(
        `Gemini returned an empty response${blockReason ? ` (${blockReason})` : ''}.`,
      );
      err.statusCode = 502;
      throw err;
    }

    let rawSpec;
    try {
      rawSpec = JSON.parse(stripMarkdownCodeFence(candidateText));
    } catch (parseErr) {
      const err = new Error(`Gemini returned malformed JSON: ${parseErr.message}`);
      err.statusCode = 502;
      throw err;
    }

    if (
      !rawSpec ||
      typeof rawSpec !== 'object' ||
      !Array.isArray(rawSpec.stages) ||
      !Array.isArray(rawSpec.variants)
    ) {
      const err = new Error('Gemini returned an incomplete ProcessSpec without stages and variants.');
      err.statusCode = 502;
      throw err;
    }

    return {
      rawSpec,
      model: targetModel,
      provider: targetProvider,
      usageMetadata: payload?.usageMetadata || null,
    };
  }

  const primary = resolveGeminiEndpoint({ apiKey: trimmedKey, model, endpoint, provider: normalizedProvider });
  let activeProvider = primary.provider;

  try {
    return await attemptRequest({
      targetModel: primary.cleanModel,
      targetEndpoint: primary.endpoint,
      targetProvider: primary.provider,
    });
  } catch (primaryErr) {
    if (endpoint || Date.now() >= deadline - 1000) {
      throw primaryErr;
    }

    // If an AQ.* key in 'auto' mode was rejected by Gemini Developer API, try Vertex AI Express Mode
    const isAuthOrDisabledErr =
      primaryErr.httpStatus === 400 ||
      primaryErr.httpStatus === 401 ||
      primaryErr.httpStatus === 403;
    if (trimmedKey.startsWith('AQ.') && normalizedProvider === 'auto' && isAuthOrDisabledErr) {
      const vertexTarget = resolveGeminiEndpoint({
        apiKey: trimmedKey,
        model: primary.cleanModel,
        provider: 'vertex-express',
      });
      try {
        return await attemptRequest({
          targetModel: vertexTarget.cleanModel,
          targetEndpoint: vertexTarget.endpoint,
          targetProvider: vertexTarget.provider,
        });
      } catch (vertexErr) {
        if (vertexErr.httpStatus === 404 || vertexErr.httpStatus === 503 || vertexErr.httpStatus === 429) {
          activeProvider = 'vertex-express';
          primaryErr = vertexErr;
        } else {
          throw vertexErr;
        }
      }
    }

    // If model is retired (404) or temporarily overloaded (503 / 429), fall back across reliable models
    if (primaryErr.httpStatus === 404 || primaryErr.httpStatus === 503 || primaryErr.httpStatus === 429) {
      for (const fallbackModel of FALLBACK_MODELS) {
        if (fallbackModel === primary.cleanModel) continue;
        if (Date.now() >= deadline - 1500) break;
        const nextTarget = resolveGeminiEndpoint({
          apiKey: trimmedKey,
          model: fallbackModel,
          provider: activeProvider,
        });
        try {
          return await attemptRequest({
            targetModel: nextTarget.cleanModel,
            targetEndpoint: nextTarget.endpoint,
            targetProvider: nextTarget.provider,
          });
        } catch (fallbackErr) {
          if (fallbackErr.httpStatus !== 404 && fallbackErr.httpStatus !== 503 && fallbackErr.httpStatus !== 429) {
            throw fallbackErr;
          }
          primaryErr = fallbackErr;
        }
      }
    }

    throw primaryErr;
  }
}
