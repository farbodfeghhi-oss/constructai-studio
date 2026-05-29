import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Run { id: string; prompt: string; status: string; created_at: string; plan_name: string | null; }

export function LiveAnalysisFeed() {
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("analysis_runs")
        .select("id, prompt, status, created_at, plan_name")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setRuns((data ?? []) as Run[]);
    };
    load();
    const channel = supabase
      .channel("dash_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "analysis_runs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const icon = (s: string) => {
    if (s === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (s === "error") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    if (s === "running") return <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="rounded-xl border border-primary/15 bg-card/50 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Letzte AI-Pipeline-Runs</h3>
          <p className="text-xs text-muted-foreground">Live-Stream der Advanced-Analysis-Engine</p>
        </div>
        <Link to="/advanced-engineering-analysis" className="text-xs text-accent hover:underline inline-flex items-center gap-1">
          Öffnen <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {runs.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Noch keine Runs gestartet.</div>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 rounded-md border border-border/60 hover:border-accent/30 transition-colors">
              {icon(r.status)}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{r.prompt}</div>
                <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span>{new Date(r.created_at).toLocaleString("de-DE")}</span>
                  <span>·</span>
                  <span>{r.id.slice(0, 8)}</span>
                  {r.plan_name && (
                    <>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">{r.plan_name}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
