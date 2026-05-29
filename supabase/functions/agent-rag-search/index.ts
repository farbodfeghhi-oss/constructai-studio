// Agent 4b: Vektor-Suche — Query via pplx-embed-v1-4b → pgvector match_knowledge_items()
// Cosine-Similarity (<=>) zwingend, da Perplexity-Embeddings unnormalisiert sind.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callEmbeddings, decodeEmbedding } from "../_shared/perplexity/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const QUERY_MODEL = "pplx-embed-v1-4b";
const EXPECTED_DIM = 2560;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Auth required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { query, match_count = 5, min_similarity = 0.6 } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emb = await callEmbeddings({ model: QUERY_MODEL, input: query });
    const vec = emb.data?.[0]?.embedding;
    if (!vec || vec.length !== 2560) throw new Error(`Unerwartete Vektor-Länge: ${vec?.length}`);

    const { data, error } = await admin.rpc("match_knowledge_items", {
      query_embedding: `[${vec.join(",")}]`,
      match_count,
      p_user_id: user.id,
    });
    if (error) throw new Error(error.message);

    const matches = (data ?? []).filter((m: { similarity: number }) => m.similarity >= min_similarity);

    return new Response(JSON.stringify({
      ok: true,
      query,
      model: QUERY_MODEL,
      matches,
      empty: matches.length === 0,
      message: matches.length === 0 ? "Kein hinreichend relevantes Wissen gefunden" : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("agent-rag-search error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
