import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PROVIDER_CONFIGS: Record<string, { url: string; envName: string; model: string; auth: "bearer" | "x-api-key" }> = {
  perplexity: {
    url: "https://api.perplexity.ai/chat/completions",
    envName: "PERPLEXITY_API_KEY",
    model: "sonar",
    auth: "bearer",
  },
  monica: {
    url: "https://openapi.monica.im/v1/chat/completions",
    envName: "MONICA_API_KEY",
    model: "gpt-4o-mini",
    auth: "bearer",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    envName: "OPENAI_API_KEY",
    model: "gpt-4o-mini",
    auth: "bearer",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    envName: "ANTHROPIC_API_KEY",
    model: "claude-3-5-haiku-20241022",
    auth: "x-api-key",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    envName: "GEMINI_API_KEY",
    model: "gemini-2.5-pro",
    auth: "bearer",
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    envName: "GROQ_API_KEY",
    model: "llama-3.1-8b-instant",
    auth: "bearer",
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    envName: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
    auth: "bearer",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();
    const config = PROVIDER_CONFIGS[provider];

    if (!config) {
      return new Response(
        JSON.stringify({ ok: false, error: `Unbekannter Provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get(config.envName);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: `Kein API-Key gespeichert (${config.envName})`, configured: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.auth === "bearer") headers["Authorization"] = `Bearer ${apiKey}`;
    else if (config.auth === "x-api-key") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    }

    // Perplexity sonar requires max_tokens >= 16
    const maxTokens = provider === "perplexity" ? 16 : 10;
    const body = JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: "test" }],
    });

    const startTime = Date.now();
    const response = await fetch(config.url, { method: "POST", headers, body });
    const latency = Date.now() - startTime;
    const responseText = await response.text();

    if (response.ok) {
      return new Response(
        JSON.stringify({ ok: true, configured: true, latency, status: response.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let errorMessage = `HTTP ${response.status}`;
    try {
      const errJson = JSON.parse(responseText);
      errorMessage = errJson.error?.message || errJson.message || errorMessage;
    } catch {
      errorMessage = responseText.slice(0, 200) || errorMessage;
    }

    return new Response(
      JSON.stringify({ ok: false, configured: true, status: response.status, error: errorMessage, latency }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
