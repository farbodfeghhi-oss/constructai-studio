import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DashboardAssets = Record<string, string>;

export function useDashboardAssets() {
  const [assets, setAssets] = useState<DashboardAssets>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const { data } = await supabase.from("dashboard_assets").select("key, image_url").eq("user_id", u.user.id);
    const map: DashboardAssets = {};
    (data ?? []).forEach((r: any) => { map[r.key] = r.image_url; });
    setAssets(map);
    setLoading(false);

    // Trigger background generation for missing keys
    const needed = ["hero", "cap_loesung", "cap_analysis", "cap_knowledge", "cap_components", "cap_docs", "cap_roles"];
    const missing = needed.some((k) => !map[k]);
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
    const { data: res } = await supabase.functions.invoke("dashboard-assets", { body: { force: true } });
    if (res?.assets) setAssets(res.assets);
    setGenerating(false);
  }, []);

  return { assets, loading, generating, regenerate };
}
