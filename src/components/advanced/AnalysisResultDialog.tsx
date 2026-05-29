import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Download, FileText, FileType2, FileCode, Image as ImageIcon,
  Sparkles, Loader2, Clock, Brain, Database, Paperclip, Quote, Layers,
  ShieldCheck, CheckCircle2, AlertTriangle,
} from "lucide-react";
import type { AnalysisRun } from "@/hooks/useAnalysisRun";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType,
} from "docx";
import jsPDF from "jspdf";

type ImageKind = "technical_drawing" | "documentation" | "isometric_render" | "exploded_view";

const KIND_OPTIONS: { value: ImageKind; label: string; hint: string }[] = [
  { value: "technical_drawing", label: "Technische Zeichnung", hint: "DIN/ISO Orthographic Views" },
  { value: "isometric_render", label: "Isometrische Darstellung", hint: "3D Produkt-Render" },
  { value: "exploded_view", label: "Explosionszeichnung", hint: "Nummerierte Callouts" },
  { value: "documentation", label: "Doku-Illustration", hint: "Anleitungs-Bild" },
];

function formatDuration(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return "—";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function collectAllCitations(run: AnalysisRun): string[] {
  const c: string[] = [];
  const push = (arr: any) => Array.isArray(arr) && arr.forEach((x: any) => {
    const u = typeof x === "string" ? x : (x?.url ?? x?.title ?? "");
    if (u) c.push(u);
  });
  push((run.design_blueprint as any)?.citations);
  push((run.verification_blueprint as any)?.citations);
  push((run.standards_validation as any)?.citations);
  return Array.from(new Set(c));
}

export function AnalysisResultDialog({
  run, open, onOpenChange,
}: { run: AnalysisRun | null; open: boolean; onOpenChange: (b: boolean) => void }) {
  const [generating, setGenerating] = useState<ImageKind | null>(null);
  const [verifyingIdx, setVerifyingIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "docx" | "html" | null>(null);

  const allCitations = useMemo(() => (run ? collectAllCitations(run) : []), [run]);
  const duration = formatDuration(run?.started_at ?? run?.created_at, run?.completed_at);

  if (!run) return null;

  const filenameBase = `engineering-report-${run.id.slice(0, 8)}`;

  // ---------- Exports ----------
  const buildHtml = (): string => {
    const md = run.final_report ?? "";
    const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const images = (run.generated_images ?? []).map((img) =>
      `<figure><img src="${img.url}" alt="${escape(img.label ?? img.kind)}" /><figcaption>${escape(img.label ?? img.kind)}</figcaption></figure>`
    ).join("\n");
    const meta = `
      <table class="meta">
        <tr><th>AI-Rolle</th><td>${escape(run.plan_name ?? "—")} <code>${escape(run.plan_key ?? "")}</code></td></tr>
        <tr><th>Rechenzeit</th><td>${duration}</td></tr>
        <tr><th>Erstellt</th><td>${new Date(run.created_at).toLocaleString("de-DE")}</td></tr>
        <tr><th>Modelle</th><td>${Object.entries(run.models_used ?? {}).map(([k, v]) => `<code>${escape(k)}: ${escape(String(v))}</code>`).join(", ") || "—"}</td></tr>
        <tr><th>Hochgeladene Dateien</th><td>${(run.file_paths ?? []).map((p) => escape(p.split("/").pop() ?? p)).join(", ") || "—"}</td></tr>
        <tr><th>Referenzen</th><td>${(run.reference_ids ?? []).length} Wissens-Items</td></tr>
      </table>`;
    const sources = allCitations.length
      ? `<h2>Quellen</h2><ol>${allCitations.map((c) => `<li><a href="${c}">${escape(c)}</a></li>`).join("")}</ol>`
      : "";
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(filenameBase)}</title>
<style>
body{font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;max-width:900px;margin:2rem auto;padding:0 1.5rem;color:#0f172a;line-height:1.6}
h1{border-bottom:2px solid #1E3A8A;padding-bottom:.5rem;color:#1E3A8A}
h2{color:#1E3A8A;margin-top:2rem}
table.meta{border-collapse:collapse;width:100%;margin:1rem 0;font-size:14px}
table.meta th{text-align:left;background:#f1f5f9;padding:8px;width:200px;border:1px solid #e2e8f0}
table.meta td{padding:8px;border:1px solid #e2e8f0}
code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px}
figure{margin:1.5rem 0;text-align:center}
figure img{max-width:100%;border:1px solid #e2e8f0;border-radius:8px}
figcaption{font-size:13px;color:#64748b;margin-top:.5rem}
pre{background:#f1f5f9;padding:1rem;border-radius:6px;overflow:auto}
a{color:#1E3A8A}
@media print{body{margin:1rem}}
</style></head><body>
<h1>Engineering Report</h1>
<p><strong>Prompt:</strong> ${escape(run.prompt)}</p>
${meta}
<hr/>
<div class="report">${mdToHtml(md)}</div>
${images ? `<h2>Generierte Bilder</h2>${images}` : ""}
${sources}
</body></html>`;
  };

  const exportHtml = () => {
    setExporting("html");
    try {
      const blob = new Blob([buildHtml()], { type: "text/html;charset=utf-8" });
      triggerDownload(blob, `${filenameBase}.html`);
    } finally { setExporting(null); }
  };

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      const writeLine = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
        pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
        pdf.setFontSize(opts.size ?? 10);
        pdf.setTextColor(...(opts.color ?? [15, 23, 42]));
        const lines = pdf.splitTextToSize(text, pageW - 2 * margin);
        for (const line of lines) {
          if (y > pageH - margin) { pdf.addPage(); y = margin; }
          pdf.text(line, margin, y);
          y += (opts.size ?? 10) * 0.45;
        }
      };

      writeLine("Engineering Report", { size: 18, bold: true, color: [30, 58, 138] });
      y += 4;
      writeLine(`Prompt: ${run.prompt}`, { size: 10 });
      y += 2;
      writeLine(`AI-Rolle: ${run.plan_name ?? "—"} (${run.plan_key ?? ""})`, { size: 9, color: [100, 116, 139] });
      writeLine(`Rechenzeit: ${duration} · Erstellt: ${new Date(run.created_at).toLocaleString("de-DE")}`, { size: 9, color: [100, 116, 139] });
      writeLine(`Modelle: ${Object.entries(run.models_used ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}`, { size: 9, color: [100, 116, 139] });
      writeLine(`Dateien: ${(run.file_paths ?? []).map((p) => p.split("/").pop()).join(", ") || "—"}`, { size: 9, color: [100, 116, 139] });
      y += 4;

      // Markdown → plaintext (preserve headings prefix)
      const stripped = (run.final_report ?? "").replace(/```[\s\S]*?```/g, (m) => m).replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
      const blocks = stripped.split(/\n\n+/);
      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("# ")) writeLine(trimmed.slice(2), { size: 14, bold: true, color: [30, 58, 138] });
        else if (trimmed.startsWith("## ")) writeLine(trimmed.slice(3), { size: 12, bold: true, color: [30, 58, 138] });
        else if (trimmed.startsWith("### ")) writeLine(trimmed.slice(4), { size: 11, bold: true });
        else writeLine(trimmed);
        y += 2;
      }

      if (allCitations.length) {
        y += 4;
        writeLine("Quellen", { size: 12, bold: true, color: [30, 58, 138] });
        allCitations.forEach((c, i) => writeLine(`${i + 1}. ${c}`, { size: 8, color: [30, 64, 175] }));
      }

      // Generated images on additional pages
      for (const img of run.generated_images ?? []) {
        try {
          const dataUrl = await urlToDataUrl(img.url);
          pdf.addPage();
          pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(30, 58, 138);
          pdf.text(img.label ?? img.kind, margin, margin);
          pdf.addImage(dataUrl, "PNG", margin, margin + 6, pageW - 2 * margin, pageH - 2 * margin - 10);
        } catch (e) { console.warn("img embed failed", e); }
      }

      pdf.save(`${filenameBase}.pdf`);
    } finally { setExporting(null); }
  };

  const exportDocx = async () => {
    setExporting("docx");
    try {
      const md = run.final_report ?? "";
      const paragraphs: Paragraph[] = [];

      paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Engineering Report")] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "Prompt: ", bold: true }), new TextRun(run.prompt)] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "AI-Rolle: ", bold: true }), new TextRun(`${run.plan_name ?? "—"} (${run.plan_key ?? ""})`)] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "Rechenzeit: ", bold: true }), new TextRun(duration)] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "Erstellt: ", bold: true }), new TextRun(new Date(run.created_at).toLocaleString("de-DE"))] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "Modelle: ", bold: true }), new TextRun(Object.entries(run.models_used ?? {}).map(([k, v]) => `${k}=${v}`).join(", ") || "—")] }));
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "Dateien: ", bold: true }), new TextRun((run.file_paths ?? []).map((p) => p.split("/").pop()).join(", ") || "—")] }));
      paragraphs.push(new Paragraph({ children: [new TextRun("")] }));

      // Markdown → simple paragraphs
      for (const raw of md.split(/\n/)) {
        const line = raw.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
        if (line.startsWith("# ")) paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.slice(2))] }));
        else if (line.startsWith("## ")) paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.slice(3))] }));
        else if (line.startsWith("### ")) paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(line.slice(4))] }));
        else if (line.startsWith("- ") || line.startsWith("* ")) paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(line.slice(2))] }));
        else if (line.trim()) paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
        else paragraphs.push(new Paragraph({ children: [new TextRun("")] }));
      }

      if (allCitations.length) {
        paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Quellen")] }));
        allCitations.forEach((c, i) => paragraphs.push(new Paragraph({ children: [new TextRun(`${i + 1}. ${c}`)], alignment: AlignmentType.LEFT })));
      }

      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      triggerDownload(blob, `${filenameBase}.docx`);
    } finally { setExporting(null); }
  };

  // ---------- Picsart ----------
  const generateImage = async (kind: ImageKind) => {
    setGenerating(kind);
    try {
      const { data, error } = await supabase.functions.invoke("generate-analysis-image", {
        body: { run_id: run.id, kind },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Bild generiert", description: KIND_OPTIONS.find((o) => o.value === kind)?.label });
    } catch (e: any) {
      toast({ title: "Bildgenerierung fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally { setGenerating(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1400px] w-[96vw] h-[92vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <DialogTitle className="text-base">Finaler Engineering Report</DialogTitle>
              <Badge variant="secondary" className="font-mono text-[10px]">{run.id.slice(0, 8)}</Badge>
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">{run.status.toUpperCase()}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={exportHtml} disabled={!run.final_report || !!exporting}>
                {exporting === "html" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileCode className="h-3.5 w-3.5 mr-1.5" />}HTML
              </Button>
              <Button size="sm" variant="outline" onClick={exportPdf} disabled={!run.final_report || !!exporting}>
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}PDF
              </Button>
              <Button size="sm" variant="outline" onClick={exportDocx} disabled={!run.final_report || !!exporting}>
                {exporting === "docx" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5 mr-1.5" />}Word
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] min-h-0">
          {/* Report */}
          <ScrollArea className="border-r">
            <div className="p-6">
              <Tabs defaultValue="report">
                <TabsList>
                  <TabsTrigger value="report">Report</TabsTrigger>
                  <TabsTrigger value="images">Bilder ({(run.generated_images ?? []).length})</TabsTrigger>
                </TabsList>
                <TabsContent value="report" className="mt-4">
                  {run.final_report ? (
                    <article className="prose prose-invert prose-sm max-w-none
                      prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl
                      prose-code:font-mono prose-code:text-accent prose-pre:bg-muted/40">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.final_report}</ReactMarkdown>
                    </article>
                  ) : (
                    <p className="text-sm text-muted-foreground">Kein Report vorhanden.</p>
                  )}
                </TabsContent>
                <TabsContent value="images" className="mt-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {KIND_OPTIONS.map((opt) => (
                      <Button key={opt.value} size="sm" variant="outline" disabled={!!generating}
                        onClick={() => generateImage(opt.value)}>
                        {generating === opt.value
                          ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          : <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-4">
                    Bilder werden von Picsart auf Basis des Reports generiert (1024×1024, ~30–60 s).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(run.generated_images ?? []).map((img, i) => (
                      <figure key={i} className="rounded-md border border-border overflow-hidden bg-card">
                        <img src={img.url} alt={img.label ?? img.kind} className="w-full h-auto" />
                        <figcaption className="p-2 text-xs flex items-center justify-between">
                          <span className="font-medium">{img.label ?? img.kind}</span>
                          <a href={img.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            <Download className="h-3 w-3 inline" />
                          </a>
                        </figcaption>
                      </figure>
                    ))}
                    {(run.generated_images ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-full">Noch keine Bilder generiert.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>

          {/* Sidebar */}
          <ScrollArea className="bg-card/30">
            <div className="p-5 space-y-5 text-sm">
              <MetaSection icon={<Brain className="h-4 w-4 text-accent" />} title="AI-Rolle">
                <div className="font-semibold">{run.plan_name ?? "—"}</div>
                {run.plan_key && <code className="text-[11px] text-muted-foreground">{run.plan_key}</code>}
              </MetaSection>

              <MetaSection icon={<Clock className="h-4 w-4 text-accent" />} title="Zeit">
                <div className="space-y-1 text-xs">
                  <div><span className="text-muted-foreground">Erstellt: </span>{new Date(run.created_at).toLocaleString("de-DE")}</div>
                  {run.completed_at && <div><span className="text-muted-foreground">Beendet: </span>{new Date(run.completed_at).toLocaleString("de-DE")}</div>}
                  <div className="font-mono text-accent">Dauer: {duration}</div>
                </div>
              </MetaSection>

              <MetaSection icon={<Layers className="h-4 w-4 text-accent" />} title="Modelle pro Phase">
                <ul className="space-y-1 text-xs">
                  {Object.entries(run.models_used ?? {}).map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-muted-foreground capitalize">{k}</span>
                      <code className="text-accent text-[10px] text-right">{String(v)}</code>
                    </li>
                  ))}
                  {Object.keys(run.models_used ?? {}).length === 0 && <li className="text-muted-foreground">—</li>}
                </ul>
              </MetaSection>

              <MetaSection icon={<FileText className="h-4 w-4 text-accent" />} title="Haupt-Prompt">
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Anzeigen ({run.prompt.length} Z.)
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap p-2 rounded bg-muted/40 leading-relaxed">{run.prompt}</p>
                </details>
              </MetaSection>

              <MetaSection icon={<Paperclip className="h-4 w-4 text-accent" />} title={`Hochgeladene Dateien (${(run.file_paths ?? []).length})`}>
                <ul className="space-y-1 text-xs">
                  {(run.file_paths ?? []).map((p, i) => (
                    <li key={i} className="font-mono text-[11px] break-all text-muted-foreground">{p.split("/").pop()}</li>
                  ))}
                  {(run.file_paths ?? []).length === 0 && <li className="text-muted-foreground">—</li>}
                </ul>
              </MetaSection>

              <MetaSection icon={<Database className="h-4 w-4 text-accent" />} title={`Referenzen (${(run.reference_ids ?? []).length})`}>
                <p className="text-xs text-muted-foreground">
                  {(run.reference_ids ?? []).length} explizit gewählte Wissens-Items (RAG-Treffer im Aggregator).
                </p>
              </MetaSection>

              <MetaSection icon={<Quote className="h-4 w-4 text-accent" />} title={`Quellen (${allCitations.length})`}>
                <ul className="space-y-1 text-xs max-h-64 overflow-auto">
                  {allCitations.map((c, i) => (
                    <li key={i}>
                      <a href={c} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">
                        {i + 1}. {c}
                      </a>
                    </li>
                  ))}
                  {allCitations.length === 0 && <li className="text-muted-foreground">—</li>}
                </ul>
              </MetaSection>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
        {icon}{title}
      </div>
      {children}
      <Separator className="mt-4" />
    </div>
  );
}

// --- helpers ---
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function urlToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// Very small markdown→HTML (headings, bold, italic, code, lists, paragraphs)
function mdToHtml(md: string): string {
  if (!md) return "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\n/);
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of lines) {
    const l = raw;
    if (/^#\s+/.test(l)) { closeList(); html += `<h1>${esc(l.replace(/^#\s+/, ""))}</h1>`; }
    else if (/^##\s+/.test(l)) { closeList(); html += `<h2>${esc(l.replace(/^##\s+/, ""))}</h2>`; }
    else if (/^###\s+/.test(l)) { closeList(); html += `<h3>${esc(l.replace(/^###\s+/, ""))}</h3>`; }
    else if (/^[-*]\s+/.test(l)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${esc(l.replace(/^[-*]\s+/, ""))}</li>`; }
    else if (l.trim() === "") { closeList(); html += ""; }
    else { closeList(); html += `<p>${esc(l).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/`(.*?)`/g, "<code>$1</code>")}</p>`; }
  }
  closeList();
  return html;
}
