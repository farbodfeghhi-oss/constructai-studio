import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Sparkles, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

interface Plan { id: string; name: string; description: string; provider_mode: string; }

export function AiModelsBar() {
  const [active, setActive] = useState<Plan | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("ai_role_plans").select("id, name, description, provider_mode").eq("is_active", true).maybeSingle();
      setActive(data as any);
    };
    load();
    const ch = supabase
      .channel("active_role")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_role_plans" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-[#0a0e27] to-[#0a0e27]/40 p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            Aktive AI-Rolle
          </div>
          <h3 className="text-xl font-bold text-foreground">{active?.name ?? "—"}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{active?.description ?? "Keine Rolle aktiv."}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-blue-400/30 bg-blue-400/5">
            <Search className="h-4 w-4 text-blue-300" />
            <span className="text-xs font-mono text-blue-200">Powered by Perplexity</span>
          </div>
          <Link
            to="/ai-roles"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Rolle ändern
          </Link>
        </div>
      </div>
    </div>
  );
}
