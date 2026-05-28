import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { History, Plus, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunRow {
  id: string;
  prompt: string;
  status: "queued" | "running" | "done" | "error";
  created_at: string;
}

interface Props {
  currentRunId: string | null;
  onSelect: (id: string | null) => void;
}

export function AnalysisHistory({ currentRunId, onSelect }: Props) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("analysis_runs")
      .select("id, prompt, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setRuns((data as RunRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("analysis_runs_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "analysis_runs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const statusIcon = (s: RunRow["status"]) => {
    if (s === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (s === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    if (s === "running") return <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="h-full flex flex-col border-r bg-card/20">
      <div className="px-3 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-widest">History</span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onSelect(null)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Neu
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading && <div className="text-xs text-muted-foreground p-3">Lädt…</div>}
          {!loading && runs.length === 0 && (
            <div className="text-xs text-muted-foreground p-3">Noch keine Analysen.</div>
          )}
          {runs.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={cn(
                "w-full text-left p-2.5 rounded-md border text-xs transition-colors",
                currentRunId === r.id
                  ? "border-accent bg-accent/10"
                  : "border-transparent hover:border-border hover:bg-muted/40"
              )}
            >
              <div className="flex items-start gap-2">
                {statusIcon(r.status)}
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-2 font-medium text-foreground/90">
                    {r.prompt || "(ohne Prompt)"}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    {new Date(r.created_at).toLocaleString("de-DE")}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
