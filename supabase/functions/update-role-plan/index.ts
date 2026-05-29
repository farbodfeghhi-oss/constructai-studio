import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { password, plan_id, name, description, system_prompt, models } = body ?? {};

    if (typeof password !== "string" || typeof plan_id !== "string") {
      return new Response(JSON.stringify({ error: "invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 1 || name.length > 80) {
        return new Response(JSON.stringify({ error: "invalid name" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      updates.name = name.trim();
    }
    if (description !== undefined) {
      if (typeof description !== "string" || description.length > 500) {
        return new Response(JSON.stringify({ error: "invalid description" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      updates.description = description.trim();
    }
    if (system_prompt !== undefined) {
      if (typeof system_prompt !== "string" || system_prompt.length < 10) {
        return new Response(JSON.stringify({ error: "invalid system_prompt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      updates.system_prompt = system_prompt;
    }
    if (models !== undefined) {
      if (typeof models !== "object" || models === null || Array.isArray(models)) {
        return new Response(JSON.stringify({ error: "models must be a JSON object" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      updates.models = models;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "no fields to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ok } = await admin.rpc("verify_admin_password", { p: password });
    if (!ok) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error } = await admin.from("ai_role_plans").update(updates).eq("id", plan_id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
