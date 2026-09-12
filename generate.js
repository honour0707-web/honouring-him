// Cloudflare Pages Function — served at /api/generate on your deployed site.
// This calls Groq — a free AI API (no credit card, sign up in under a
// minute at https://console.groq.com — see SETUP-GUIDE.md Step 4). Your
// Groq key lives only here, on the server; it's never sent to the browser.
//
// Two other backends are included as ready-to-swap alternatives in this
// same folder if you ever want them:
//   - generate.workersai.js.example  — Cloudflare's own built-in AI (free,
//     but some accounts are asked to "book a demo" before it unlocks)
//   - generate.anthropic.js.example  — Claude itself (small ongoing cost,
//     best writing quality)

const MODEL_FOR_TIER = {
  quick: "llama-3.1-8b-instant",
  complex: "llama-3.3-70b-versatile"
};

const SYSTEM_PROMPT =
  "You reply with ONLY a single valid JSON object and nothing else — no " +
  "prose, no markdown code fences, no commentary before or after it. If " +
  "you are unsure, still return your best-effort JSON in the requested shape.";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "bad_request", code: "bad_request" }, 400);
  }

  const prompt = body && body.prompt;
  if (!prompt || typeof prompt !== "string") {
    return jsonResponse({ error: "missing_prompt", code: "bad_request" }, 400);
  }
  if (!env.GROQ_API_KEY) {
    return jsonResponse({ error: "server_not_configured", code: "not_declared" }, 500);
  }

  const modelTier = body.modelTier === "quick" ? "quick" : "complex";
  const model = MODEL_FOR_TIER[modelTier];

  let upstream;
  try {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ]
      })
    });
  } catch (err) {
    return jsonResponse({ error: "network_error", code: "refused" }, 502);
  }

  if (!upstream.ok) {
    const code = upstream.status === 429 ? "rate_limited" : "refused";
    let detail = "";
    try { detail = await upstream.text(); } catch (e) {}
    return jsonResponse({ error: "upstream_error", code: code, detail: detail.slice(0, 500) }, upstream.status);
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return jsonResponse({ error: "invalid_upstream_response", code: "invalid_json" }, 502);
  }

  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  const parsed = extractJson(text);
  if (parsed === null) {
    return jsonResponse({ error: "invalid_json", code: "invalid_json" }, 502);
  }
  return jsonResponse(parsed, 200);
}

// The model is asked to reply with ONLY a JSON object, but strips/guards here in case
// it wraps the JSON in a little extra prose despite instructions.
function extractJson(text) {
  var trimmed = (text || "").trim();
  // Some models wrap JSON in ```json fences despite instructions — strip those first.
  trimmed = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  var first = trimmed.indexOf("{");
  var last = trimmed.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    return JSON.parse(trimmed.slice(first, last + 1));
  } catch (e) {
    return null;
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { "content-type": "application/json" }
  });
}
