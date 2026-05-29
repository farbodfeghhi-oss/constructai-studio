import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DashboardAssets = Record<string, string>;
const NEEDED = ["hero", "cap_loesung", "cap_analysis", "cap_knowledge", "cap_components", "cap_docs", "cap_roles"];

export function useDashboardAssets() {
  const [assets, setAssets] = useState<DashboardAssets>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [regeneratingKeys, setRegeneratingKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase.from("dashboard_assets").select("key, image_url").eq("user_id", u.user.id);
    const map: DashboardAssets = {};
    (data ?? []).forEach((r: any) => { map[r.key] = r.image_url; });
    setAssets(map);
    setLoading(false);

    const missing = NEEDED.some((k) => !map[k]);
    if (missing) {
      setGenerating(true);
      supabase.functions.invoke("dashboard-assets", { body: {} }).then(({ data: res }) => {
        if (res?.assets) setAssets((prev) => ({ ...prev, ...res.assets }));
      }).finally(() => setGenerating(false));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const regenerate = useCallback(async () => {
    setGenerating(true);
    setRegeneratingKeys(new Set(NEEDED));
    try {
      const { data: res } = await supabase.functions.invoke("dashboard-assets", { body: { force: true } });
      if (res?.assets) setAssets(res.assets);
    } finally {
      setGenerating(false);
      setRegeneratingKeys(new Set());
    }
  }, []);

  const regenerateKey = useCallback(async (key: string) => {
    setRegeneratingKeys((prev) => new Set(prev).add(key));
    try {
      const { data: res } = await supabase.functions.invoke("dashboard-assets", { body: { keys: [key] } });
      if (res?.assets?.[key]) setAssets((prev) => ({ ...prev, [key]: res.assets[key] }));
    } finally {
      setRegeneratingKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, []);

  return { assets, loading, generating, regenerate, regenerateKey, regeneratingKeys };
}
