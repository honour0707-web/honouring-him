// This is a Cloudflare Worker that serves the whole Honouring Him site.
// It serves every normal page/file as-is, and additionally handles one
// special address, /api/generate, itself — that's the one that talks to
// Groq (a free AI API) to write each study, sermon, and devotional.
//
// Your Groq key lives only here, on the server; it's never sent to a
// visitor's browser. See SETUP-GUIDE.md Step 4 for how to get a free key,
// and Step 5 for how to add it to this project as GROQ_API_KEY.

const MODEL_FOR_TIER = {
  quick: "llama-3.1-8b-instant",
  complex: "llama-3.3-70b-versatile"
};

const SYSTEM_PROMPT =
  "You reply with ONLY a single valid JSON object and nothing else — no " +
  "prose, no markdown code fences, no commentary before or after it. If " +
  "you are unsure, still return your best-effort JSON in the requested shape.";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/generate" && request.method === "POST") {
      return handleGenerate(request, env);
    }

    // Everything else is just the website's normal files.
    return env.ASSETS.fetch(request);
  }
};

async function handleGenerate(request, env) {
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
