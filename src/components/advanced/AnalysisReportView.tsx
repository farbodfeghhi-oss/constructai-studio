import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, FileText, ShieldCheck, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { AnalysisRun } from "@/hooks/useAnalysisRun";
import { useDeepResearchJob } from "@/hooks/useDeepResearchJob";
import { toast } from "@/hooks/use-toast";

export function AnalysisReportView({ run }: { run: AnalysisRun | null }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { job, submit, submitting } = useDeepResearchJob();

  const runDeepStandards = async () => {
    if (!run?.final_report) return;
    const res = await submit(
      `Prüfe folgenden Engineering-Report tiefgehend gegen aktuelle Normen (DIN, EN, ISO, IEC, ASME). Liefere konkrete Verstöße, Konformitäts-Status und Korrekturmaßnahmen.\n\nREPORT:\n${run.final_report.slice(0, 8000)}`,
    );
    if (res) toast({ title: "Deep Research gestartet", description: "Async Job · Polling alle 5s (TTL 7 Tage)." });
  };


  const exportPdf = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#0a0a0a" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let pos = 0;
    pdf.addImage(imgData, "PNG", 0, pos, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      pos = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, pos, imgW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(`engineering-report-${run?.id.slice(0, 8)}.pdf`);
  };

  if (!run) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold mb-1">Bereit für die Analyse</h3>
          <p className="text-sm text-muted-foreground">Lade Dateien hoch, wähle Referenzen aus und starte die Multi-Agent-Pipeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {run.plan_name && (
        <div className="px-4 pt-3 pb-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded bg-accent/10 text-accent border border-accent/30">
            Ausgeführt mit Rolle: <strong className="font-semibold">{run.plan_name}</strong>
            {run.plan_key && <code className="opacity-60">· {run.plan_key}</code>}
          </span>
        </div>
      )}
      <Tabs defaultValue="final" className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between p-4 pb-2 gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="final">Final Report</TabsTrigger>
            <TabsTrigger value="design">Mechanik-Design</TabsTrigger>
            <TabsTrigger value="verification">Mathematische Verifizierung</TabsTrigger>
            <TabsTrigger value="validation">Normen-Validierung</TabsTrigger>
            <TabsTrigger value="standards">Normen Deep Research</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {run.final_report && (
              <Button size="sm" variant="outline" onClick={runDeepStandards} disabled={submitting || (job?.status === "pending" || job?.status === "in_progress")}>
                {(submitting || job?.status === "pending" || job?.status === "in_progress")
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                Normen Deep Research
              </Button>
            )}
            {run.final_report && (
              <Button size="sm" variant="outline" onClick={exportPdf}>
                <Download className="h-3.5 w-3.5 mr-1.5" />PDF
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="final" className="flex-1 overflow-auto px-4 pb-4 mt-0">
          {run.final_report ? (
            <div ref={reportRef} className="prose prose-invert prose-sm max-w-none font-sans
              prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
              prose-code:font-mono prose-code:text-accent prose-pre:bg-muted/40
              prose-table:text-sm prose-th:bg-muted/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {run.final_report}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-4">Wartet auf Perplexity Tech Docu Synthesizer…</p>
          )}
        </TabsContent>

        <TabsContent value="design" className="flex-1 overflow-auto px-4 pb-4 mt-0">
          {run.design_blueprint ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.design_blueprint.content ?? ""}</ReactMarkdown>
              {run.design_blueprint.citations?.length > 0 && (
                <div className="mt-4 not-prose">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Quellen</h4>
                  <ul className="text-xs space-y-1">
                    {run.design_blueprint.citations.map((c: any, i: number) => (
                      <li key={i}><a href={typeof c === "string" ? c : c?.url} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">{typeof c === "string" ? c : (c?.title ?? c?.url)}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground p-4">Wartet auf Perplexity Mechanik-Design…</p>}
        </TabsContent>

        <TabsContent value="validation" className="flex-1 overflow-auto px-4 pb-4 mt-0">
          {run.standards_validation ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.standards_validation.content ?? ""}</ReactMarkdown>
              {run.standards_validation.citations?.length > 0 && (
                <div className="mt-4 not-prose">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Quellen</h4>
                  <ul className="text-xs space-y-1">
                    {run.standards_validation.citations.map((c: any, i: number) => (
                      <li key={i}><a href={typeof c === "string" ? c : c?.url} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">{typeof c === "string" ? c : (c?.title ?? c?.url)}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground p-4">Wartet auf Perplexity Normen Deep Research…</p>}
        </TabsContent>

        <TabsContent value="standards" className="flex-1 overflow-auto px-4 pb-4 mt-0">
          {!job ? (
            <p className="text-sm text-muted-foreground p-4">
              Klicke „Normen Deep Research", um eine asynchrone Tiefen-Recherche (sonar-deep-research, search_mode=academic, gefiltert auf iso.org/din.de/beuth.de/cen.eu) gegen den finalen Report zu starten.
            </p>
          ) : job.status === "completed" && job.result ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{(job.result as any).content ?? ""}</ReactMarkdown>
              {job.citations?.length > 0 && (
                <div className="mt-4 not-prose">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Quellen ({job.citations.length})</h4>
                  <ul className="text-xs space-y-1">
                    {job.citations.map((c: any, i: number) => (
                      <li key={i}>
                        <a href={c.url ?? c} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">
                          {c.title ?? c.url ?? String(c)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : job.status === "failed" ? (
            <p className="text-sm text-destructive p-4">Deep Research fehlgeschlagen: {job.error}</p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Deep Research läuft… (Polling alle 5s · TTL 7 Tage)
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
