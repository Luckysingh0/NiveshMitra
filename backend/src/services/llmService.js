import OpenAI from "openai";
import {
  CALM_MODE_DIRECTIVE,
  DETAILED_MODE_DIRECTIVE,
} from "../prompts/systemPrompts.js";

// ---- Pluggable provider config ----------------------------------------
// LLM_PROVIDER: "gemini" (default) | "openrouter"
// Both use the OpenAI-compatible Chat Completions API, so one SDK serves both.
const PROVIDER = (process.env.LLM_PROVIDER || "gemini").toLowerCase();

function resolveProvider() {
  if (PROVIDER === "openrouter") {
    return {
      name: "openrouter",
      mode: "openai",
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL:
        process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      model:
        process.env.OPENROUTER_MODEL ||
        "meta-llama/llama-3.3-70b-instruct:free",
      headers: {
        "HTTP-Referer":
          process.env.OPENROUTER_SITE_URL || "http://localhost:5173",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "NiveshMitra",
      },
    };
  }
  // Default: Google Gemini via its NATIVE REST API (X-goog-api-key header).
  // The OpenAI-compatible endpoint uses Bearer auth which Ai-Studio "AQ." keys
  // reject — the native header method works for both AQ and AIza keys.
  return {
    name: "gemini",
    mode: "gemini-native",
    apiKey: process.env.GEMINI_API_KEY,
    baseURL:
      process.env.GEMINI_BASE_URL_NATIVE ||
      "https://generativelanguage.googleapis.com/v1beta",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    // Tried in order if the primary returns 503/overloaded.
    fallbackModels: (
      process.env.GEMINI_FALLBACK_MODELS ||
      "gemini-flash-lite-latest,gemini-3-flash-preview"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    headers: {},
  };
}

const provider = resolveProvider();
const apiKey = provider.apiKey;
const MOCK = process.env.MOCK_LLM === "true" || !apiKey;
const MODEL = provider.model;

let client = null;
if (!MOCK && provider.mode === "openai") {
  client = new OpenAI({
    apiKey,
    baseURL: provider.baseURL,
    defaultHeaders: provider.headers,
  });
}

export function isMockMode() {
  return MOCK;
}

export function providerInfo() {
  return { provider: provider.name, model: MODEL, mock: MOCK };
}

/**
 * Robustly extract the first JSON object from an LLM string.
 * Free models often wrap JSON in prose or ```json fences.
 */
export function safeParseJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  let text = raw.trim();
  // Strip code fences.
  text = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  // Direct parse.
  try {
    return JSON.parse(text);
  } catch (_) {
    /* fall through */
  }
  // Grab the outermost {...} block.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {
      /* give up */
    }
  }
  return null;
}

/**
 * Call the LLM with a system prompt + prior turns + current user message.
 * Returns parsed JSON (per system prompt contract) plus the raw text fallback.
 *
 * @param {Object}   opts
 * @param {string}   opts.systemPrompt
 * @param {Array}    opts.history          [{ role, content }]
 * @param {string}   opts.userMessage
 * @param {boolean}  opts.calmMode         append calm-mode directive
 * @param {boolean}  opts.thinkMode        enable deeper reasoning + richer reply
 */
export async function chatJSON({
  systemPrompt,
  history = [],
  userMessage,
  calmMode = false,
  thinkMode = false,
}) {
  let system = calmMode
    ? `${systemPrompt}\n\n${CALM_MODE_DIRECTIVE}`
    : systemPrompt;
  if (thinkMode) {
    system = `${system}\n\n${DETAILED_MODE_DIRECTIVE}`;
  }

  if (MOCK) {
    return mockResponse(userMessage, calmMode);
  }

  // ---- Native Gemini REST path (X-goog-api-key header) ----
  if (provider.mode === "gemini-native") {
    try {
      const raw = await callGeminiNative({
        system,
        history,
        userMessage,
        thinkMode,
      });
      const parsed = safeParseJSON(raw);
      if (parsed && parsed.response_text) {
        return { ...normalize(parsed), _raw: raw, _mock: false };
      }
      return {
        response_text:
          raw ||
          "Sorry, I had trouble forming a reply. Could you say that again?",
        detected_emotion: "neutral",
        risk_signal: "none",
        confidence: 0.3,
        profile_updates: {},
        onboarding_complete: false,
        _raw: raw,
        _mock: false,
      };
    } catch (err) {
      console.error("Gemini call failed:", err.message);
      return {
        ...mockResponse(userMessage, calmMode),
        response_text:
          "I'm having a little trouble reaching my brain right now — but I'm still here. Want to try again?",
        _error: err.message,
      };
    }
  }

  const messages = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: thinkMode ? 1200 : 600,
      // Many OpenRouter models honor this; parser handles ones that don't.
      response_format: { type: "json_object" },
    });
    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJSON(raw);
    if (parsed && parsed.response_text) {
      return { ...normalize(parsed), _raw: raw, _mock: false };
    }
    // Model didn't return valid JSON — degrade gracefully using raw text.
    return {
      response_text:
        raw ||
        "Sorry, I had trouble forming a reply. Could you say that again?",
      detected_emotion: "neutral",
      risk_signal: "none",
      confidence: 0.3,
      profile_updates: {},
      onboarding_complete: false,
      _raw: raw,
      _mock: false,
    };
  } catch (err) {
    console.error("LLM call failed:", err.message);
    return {
      ...mockResponse(userMessage, calmMode),
      response_text:
        "I'm having a little trouble reaching my brain right now — but I'm still here. Want to try again?",
      _error: err.message,
    };
  }
}

/**
 * Call Google Gemini via the native REST API using the X-goog-api-key header.
 * Returns the raw text of the model's reply (expected to be JSON per our prompt).
 * Retries the primary model on 503/overload, then tries fallback models.
 */
async function callGeminiNative({
  system,
  history,
  userMessage,
  thinkMode = false,
}) {
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  // thinkMode ON  -> dynamic thinking budget (-1) so the model reasons before
  //                  replying, and a larger output cap (thinking tokens count).
  // thinkMode OFF -> thinking disabled (0) for fast, concise JSON.
  const maxOutputTokens = thinkMode
    ? Number(process.env.GEMINI_THINK_MAX_TOKENS || 4096)
    : Number(process.env.GEMINI_MAX_TOKENS || 1024);

  const payload = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: thinkMode ? -1 : 0 },
    },
  };

  const modelsToTry = [provider.model, ...(provider.fallbackModels || [])];
  let lastErr = "unknown error";

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `${provider.baseURL}/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        const json = await res.json();
        const text =
          json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ??
          "";
        return text;
      }

      const bodyText = await res.text();
      lastErr = `HTTP ${res.status} ${bodyText.slice(0, 160)}`;
      // 503 = overloaded → retry then next model. 429 = quota → skip to next.
      if (res.status === 503) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      break;
    }
  }
  throw new Error(lastErr);
}

function normalize(p) {
  return {
    response_text: String(p.response_text || ""),
    detected_emotion: p.detected_emotion || "neutral",
    risk_signal: ["none", "low", "medium", "high"].includes(p.risk_signal)
      ? p.risk_signal
      : "none",
    confidence: typeof p.confidence === "number" ? p.confidence : 0.5,
    profile_updates: p.profile_updates || {},
    onboarding_complete: Boolean(p.onboarding_complete),
  };
}

/** Deterministic canned responses so the demo works without a key / network. */
function mockResponse(userMessage, calmMode) {
  if (calmMode) {
    return {
      response_text:
        "I hear you — that fear is completely valid. Take a breath. Markets dip; your plan was built for exactly these moments. Let's not act on panic. Can we look at your goals together before doing anything?",
      detected_emotion: "panic",
      risk_signal: "high",
      confidence: 0.9,
      profile_updates: {},
      onboarding_complete: false,
      _mock: true,
    };
  }
  return {
    response_text:
      "(mock) Thanks for sharing that! To tailor your plan, what's your biggest financial goal right now — and roughly how many years away is it?",
    detected_emotion: "neutral",
    risk_signal: "none",
    confidence: 0.6,
    profile_updates: {},
    onboarding_complete: false,
    _mock: true,
  };
}
