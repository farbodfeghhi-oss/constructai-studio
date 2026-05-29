// Agent 4a: Dokument-Embedding via pplx-embed-context-v1-4b (2560 dim, unnormalisiert)
// Mean-Pooling — KEINE Instruction-Prefixes. Text wird direkt eingebettet.
// Schreibt knowledge_items.embedding für die anschließende Cosine-Suche.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callEmbeddings } from "../_shared/perplexity/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const DOC_MODEL = "pplx-embed-context-v1-4b";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Auth required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { knowledge_item_ids } = await req.json() as { knowledge_item_ids?: string[] };
    if (!Array.isArray(knowledge_item_ids) || knowledge_item_ids.length === 0) {
      return new Response(JSON.stringify({ error: "knowledge_item_ids (array) erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items, error } = await admin.from("knowledge_items")
      .select("id,title,ai_summary,extracted_text,user_id")
      .in("id", knowledge_item_ids)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    if (!items?.length) return new Response(JSON.stringify({ error: "Keine Items gefunden" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const inputs = items.map((it) => {
      const body = (it.ai_summary ?? it.extracted_text ?? "").slice(0, 20000);
      return `${it.title}\n\n${body}`;
    });

    const emb = await callEmbeddings({ model: DOC_MODEL, input: inputs });
    if (!emb.data || emb.data.length !== items.length) {
      throw new Error(`Embeddings-Anzahl stimmt nicht: ${emb.data?.length} vs ${items.length}`);
    }

    const updates = await Promise.all(items.map((it, i) => {
      const vec = emb.data.find((d) => d.index === i)?.embedding ?? emb.data[i]?.embedding;
      if (!vec || vec.length !== 2560) throw new Error(`Unerwartete Vektor-Länge: ${vec?.length}`);
      const vectorLiteral = `[${vec.join(",")}]`;
      return admin.from("knowledge_items")
        .update({ embedding: vectorLiteral, embedding_model: DOC_MODEL })
        .eq("id", it.id);
    }));

    const failed = updates.filter((u) => u.error).map((u) => u.error?.message);

    return new Response(JSON.stringify({
      ok: true,
      embedded: items.length - failed.length,
      failed,
      model: DOC_MODEL,
      dim: 2560,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("agent-rag-embed error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
