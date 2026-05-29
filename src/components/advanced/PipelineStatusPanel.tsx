import { Loader2, CheckCircle2, Circle, AlertTriangle, RotateCw, Layers, Brain, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { AnalysisRun, PhaseKey } from "@/hooks/useAnalysisRun";

const PHASES: Array<{ key: PhaseKey; label: string; sub: string; icon: any }> = [
  { key: "aggregator", label: "Context Aggregator", sub: "Dateien, Referenzen & Prompt ingestieren", icon: Layers },
  { key: "design", label: "Perplexity · Mechanik-Design", sub: "Multimodale Bild-/CAD-Analyse · Claude Opus 4.7 / Sonar Vision", icon: Brain },
  { key: "standards", label: "Perplexity · Normen Deep Research", sub: "sonar-deep-research · academic · ISO/DIN/EN", icon: Search },
  { key: "docgen", label: "Perplexity · Tech Docu Synthesizer", sub: "Sonar Pro · json_schema · Finaler Engineering Report", icon: Sparkles },
];

export function PipelineStatusPanel({ run }: { run: AnalysisRun | null }) {
  const retry = async (phase: PhaseKey) => {
    if (!run) return;
    const { error } = await supabase.functions.invoke("advanced-analysis-retry", { body: { run_id: run.id, phase } });
    if (error) toast({ title: "Retry fehlgeschlagen", description: error.message, variant: "destructive" });
    else toast({ title: `Phase "${phase}" neu gestartet` });
  };

  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Live AI Pipeline</h3>
        {run && <span className="text-[10px] font-mono text-muted-foreground">{run.id.slice(0, 8)}</span>}
      </div>
      <ol className="space-y-2">
        {PHASES.map((p, i) => {
          const state = run?.phase_status?.[p.key]?.status ?? "pending";
          const err = run?.phase_status?.[p.key]?.error;
          const Icon = p.icon;
          return (
            <li key={p.key} className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
              state === "running" ? "border-accent bg-accent/5" :
              state === "done" ? "border-green-500/30 bg-green-500/5" :
              state === "error" ? "border-destructive/40 bg-destructive/5" : "border-border"
            }`}>
              <div className="mt-0.5">
                {state === "running" && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
                {state === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {state === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                {state === "pending" && <Circle className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{i + 1}. {p.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.sub}</p>
                {err && <p className="text-xs text-destructive mt-1 font-mono">{err}</p>}
              </div>
              {state === "error" && run && (
                <Button size="sm" variant="outline" onClick={() => retry(p.key)} className="h-7 text-xs">
                  <RotateCw className="h-3 w-3 mr-1" />Retry
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
