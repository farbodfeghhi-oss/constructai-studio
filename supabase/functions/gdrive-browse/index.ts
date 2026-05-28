import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";

function gwHeaders() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!GOOGLE_DRIVE_API_KEY) throw new Error("GOOGLE_DRIVE_API_KEY is not configured — Google Drive connection missing");
  return {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const query = (body.query as string | undefined)?.trim() ?? "";
      const onlySupported = "(mimeType='application/pdf' or mimeType contains 'image/')";
      const q = query
        ? `${onlySupported} and name contains '${query.replace(/'/g, "\\'")}' and trashed=false`
        : `${onlySupported} and trashed=false`;
      const url = new URL(`${GATEWAY_BASE}/drive/v3/files`);
      url.searchParams.set("q", q);
      url.searchParams.set("pageSize", "50");
      url.searchParams.set("orderBy", "modifiedTime desc");
      url.searchParams.set("fields", "files(id,name,mimeType,size,modifiedTime,iconLink,thumbnailLink)");

      const r = await fetch(url.toString(), { headers: gwHeaders() });
      const data = await r.json();
      if (!r.ok) throw new Error(`Drive list failed [${r.status}]: ${JSON.stringify(data)}`);
      return new Response(JSON.stringify({ files: data.files ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download") {
      const fileId = body.fileId as string;
      if (!fileId) throw new Error("fileId is required");

      const metaUrl = `${GATEWAY_BASE}/drive/v3/files/${fileId}?fields=id,name,mimeType,size`;
      const metaRes = await fetch(metaUrl, { headers: gwHeaders() });
      const meta = await metaRes.json();
      if (!metaRes.ok) throw new Error(`Drive metadata failed [${metaRes.status}]: ${JSON.stringify(meta)}`);

      const dlUrl = `${GATEWAY_BASE}/drive/v3/files/${fileId}?alt=media`;
      const dlRes = await fetch(dlUrl, { headers: gwHeaders() });
      if (!dlRes.ok) {
        const t = await dlRes.text();
        throw new Error(`Drive download failed [${dlRes.status}]: ${t}`);
      }
      const buf = new Uint8Array(await dlRes.arrayBuffer());
      // base64 encode
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);

      return new Response(JSON.stringify({
        id: meta.id,
        name: meta.name,
        mimeType: meta.mimeType,
        size: meta.size,
        base64,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("gdrive-browse error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
