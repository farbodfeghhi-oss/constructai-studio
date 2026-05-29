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
      <Tabs defaultValue="final" className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between p-4 pb-2">
          <TabsList>
            <TabsTrigger value="final">Final Report</TabsTrigger>
            <TabsTrigger value="gemini">Gemini Blueprint</TabsTrigger>
            <TabsTrigger value="perplexity">Validation</TabsTrigger>
          </TabsList>
          {run.monica_report && (
            <Button size="sm" variant="outline" onClick={exportPdf}>
              <Download className="h-3.5 w-3.5 mr-1.5" />PDF
            </Button>
          )}
        </div>

        <TabsContent value="final" className="flex-1 overflow-auto px-4 pb-4 mt-0">
          {run.monica_report ? (
            <div ref={reportRef} className="prose prose-invert prose-sm max-w-none font-sans
              prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
              prose-code:font-mono prose-code:text-accent prose-pre:bg-muted/40
              prose-table:text-sm prose-th:bg-muted/50">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {run.monica_report}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground p-4">Wartet auf Monica AI Synthese…</p>
          )}
        </TabsContent>

        <TabsContent value="gemini" className="flex-1 overflow-auto px-4 pb-4 mt-0">
          {run.gemini_blueprint ? (
            <pre className="text-xs font-mono bg-muted/30 p-4 rounded whitespace-pre-wrap break-words">
              {JSON.stringify(run.gemini_blueprint, null, 2)}
            </pre>
          ) : <p className="text-sm text-muted-foreground p-4">Wartet auf Gemini Blueprint…</p>}
        </TabsContent>

        <TabsContent value="perplexity" className="flex-1 overflow-auto px-4 pb-4 mt-0">
          {run.perplexity_validation ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.perplexity_validation.content ?? ""}</ReactMarkdown>
              {run.perplexity_validation.citations?.length > 0 && (
                <div className="mt-4 not-prose">
                  <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Quellen</h4>
                  <ul className="text-xs space-y-1">
                    {run.perplexity_validation.citations.map((c: string, i: number) => (
                      <li key={i}><a href={c} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">{c}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground p-4">Wartet auf Perplexity Validierung…</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
