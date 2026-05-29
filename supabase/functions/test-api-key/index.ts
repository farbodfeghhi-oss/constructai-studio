import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Perplexity-only API key validation. All other providers were removed in Phase 8.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, configured: false, error: "Kein PERPLEXITY_API_KEY gespeichert." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const startTime = Date.now();
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        max_tokens: 16,
        messages: [{ role: "user", content: "test" }],
      }),
    });
    const latency = Date.now() - startTime;
    const text = await response.text();

    if (response.ok) {
      return new Response(
        JSON.stringify({ ok: true, configured: true, latency, status: response.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let errorMessage = `HTTP ${response.status}`;
    try {
      const j = JSON.parse(text);
      errorMessage = j.error?.message || j.message || errorMessage;
    } catch {
      errorMessage = text.slice(0, 200) || errorMessage;
    }

    return new Response(
      JSON.stringify({ ok: false, configured: true, status: response.status, error: errorMessage, latency }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
