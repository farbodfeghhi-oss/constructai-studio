import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { AnalysisInputPanel } from "@/components/advanced/AnalysisInputPanel";
import { PipelineStatusPanel } from "@/components/advanced/PipelineStatusPanel";
import { AnalysisReportView } from "@/components/advanced/AnalysisReportView";
import { useAnalysisRun } from "@/hooks/useAnalysisRun";
import { Sparkles } from "lucide-react";

export default function AdvancedEngineeringAnalysis() {
  const [runId, setRunId] = useState<string | null>(null);
  const { run } = useAnalysisRun(runId);
  const active = run && run.status !== "done" && run.status !== "error";

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between bg-card/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Advanced Engineering Analysis</h1>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">Multi-Agent Pipeline · Gemini → Perplexity → Monica</p>
          </div>
        </div>
        {run && (
          <div className="text-xs font-mono text-muted-foreground">
            Status: <span className={
              run.status === "done" ? "text-green-500" :
              run.status === "error" ? "text-destructive" :
              "text-accent"
            }>{run.status.toUpperCase()}</span>
          </div>
        )}
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={38} minSize={28}>
          <AnalysisInputPanel onStart={setRunId} disabled={!!active} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={62} minSize={40}>
          <div className="flex flex-col h-full">
            <PipelineStatusPanel run={run} />
            <AnalysisReportView run={run} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
