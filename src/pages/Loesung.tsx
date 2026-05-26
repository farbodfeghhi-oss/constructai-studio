import { useState, useEffect, useCallback } from "react";
import { Loader2, Trophy, Coins, Zap, Wrench, ArrowLeft, History, Trash2, FileText, Search, Wand2, Download, Copy, Check, Image as ImageIcon } from "lucide-react";
import { ProviderSelect, type AIProvider, type MonicaModel } from "@/components/ProviderSelect";
import { RichMediaInput } from "@/components/RichMediaInput";
import { type Attachment } from "@/components/AttachmentPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";

interface Loesung {
  titel: string;
  typ: string;
  beschreibung: string;
  komponenten: { name: string; norm: string; material: string; menge: string; preis: string }[];
  vorteile: string[];
  nachteile: string[];
  kosten: { material: string; fertigung: string; gesamt: string };
  cadTipps: string[];
}

interface SavedSolution {
  id: string;
  created_at: string;
  projekt_name: string | null;
  anforderungen: string;
  provider: string | null;
  loesungen: Loesung[];
  raw_response: string | null;
}

interface DeepAnalysis {
  festigkeit?: { beschreibung: string; berechnungen: string[]; sicherheitsfaktor: string };
  toleranzen?: { bauteil: string; toleranz: string; passung: string; norm: string }[];
  werkstoffkennwerte?: { material: string; zugfestigkeit: string; streckgrenze: string; haerte: string; dichte: string }[];
  normenDetails?: { norm: string; titel: string; relevanz: string }[];
  fertigungshinweise?: string[];
  qualitaetspruefung?: string[];
  rawResponse?: string;
}

interface TechnicalPrompts {
  zeichnungsPrompt?: string;
  stuecklistePrompt?: string;
  praesentationPrompt?: string;
  montagePrompt?: string;
  rawResponse?: string;
}

const tabIcons: Record<string, typeof Trophy> = { best: Trophy, cheap: Coins, performance: Zap };
const tabLabels: Record<string, string> = { best: "Beste Empfehlung", cheap: "Kostengünstig", performance: "Hochleistung" };

function DeepAnalysisView({ analysis }: { analysis: DeepAnalysis }) {
  if (analysis.rawResponse) {
    return <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">{analysis.rawResponse}</pre>;
  }
  return (
    <div className="space-y-4">
      {analysis.festigkeit && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🔩 Festigkeitsanalyse</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{analysis.festigkeit.beschreibung}</p>
            <p className="text-xs text-muted-foreground">Sicherheitsfaktor: <span className="font-mono font-bold">{analysis.festigkeit.sicherheitsfaktor}</span></p>
            {analysis.festigkeit.berechnungen?.map((b, i) => (
              <p key={i} className="text-xs font-mono bg-muted p-2 rounded">{b}</p>
            ))}
          </CardContent>
        </Card>
      )}
      {analysis.toleranzen && analysis.toleranzen.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">📏 Toleranzen & Passungen</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Bauteil</TableHead><TableHead>Toleranz</TableHead><TableHead>Passung</TableHead><TableHead>Norm</TableHead></TableRow></TableHeader>
              <TableBody>{analysis.toleranzen.map((t, i) => (
                <TableRow key={i}><TableCell className="text-sm">{t.bauteil}</TableCell><TableCell className="font-mono text-xs">{t.toleranz}</TableCell><TableCell className="text-sm">{t.passung}</TableCell><TableCell className="font-mono text-xs">{t.norm}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {analysis.werkstoffkennwerte && analysis.werkstoffkennwerte.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🧪 Werkstoffkennwerte</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Zugfestigkeit</TableHead><TableHead>Streckgrenze</TableHead><TableHead>Härte</TableHead><TableHead>Dichte</TableHead></TableRow></TableHeader>
              <TableBody>{analysis.werkstoffkennwerte.map((w, i) => (
                <TableRow key={i}><TableCell className="text-sm">{w.material}</TableCell><TableCell className="font-mono text-xs">{w.zugfestigkeit}</TableCell><TableCell className="font-mono text-xs">{w.streckgrenze}</TableCell><TableCell className="font-mono text-xs">{w.haerte}</TableCell><TableCell className="font-mono text-xs">{w.dichte}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {analysis.fertigungshinweise && analysis.fertigungshinweise.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🏭 Fertigungshinweise</CardTitle></CardHeader>
          <CardContent><ul className="space-y-1">{analysis.fertigungshinweise.map((f, i) => <li key={i} className="text-sm">→ {f}</li>)}</ul></CardContent>
        </Card>
      )}
    </div>
  );
}

function PromptCopyCard({ label, prompt }: { label: string; prompt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">{label}</p>
          <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Kopiert" : "Kopieren"}
          </Button>
        </div>
        <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-3 rounded-md max-h-40 overflow-y-auto">{prompt}</pre>
      </CardContent>
    </Card>
  );
}

type PicsartDocType = "zeichnung" | "stueckliste" | "montage" | "praesentation";
interface PicsartDoc { imageUrl: string; prompt: string; label: string; docType: PicsartDocType; }

const PICSART_DOCS: { type: PicsartDocType; label: string; emoji: string }[] = [
  { type: "zeichnung", label: "Technische Zeichnung", emoji: "📐" },
  { type: "stueckliste", label: "Stückliste", emoji: "📋" },
  { type: "montage", label: "Montageanleitung", emoji: "🔧" },
  { type: "praesentation", label: "Präsentation", emoji: "📊" },
];

function SolutionActions({ loesung, provider, model, projektName }: { loesung: Loesung; provider: AIProvider; model?: MonicaModel; projektName?: string }) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null);
  const [techPrompts, setTechPrompts] = useState<TechnicalPrompts | null>(null);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [picsartDocs, setPicsartDocs] = useState<PicsartDoc[]>([]);

  const generatePicsartDoc = async (docType: PicsartDocType) => {
    setLoadingAction(`picsart-${docType}`);
    try {
      const { data, error } = await supabase.functions.invoke("generate-picsart-doc", {
        body: { loesung, docType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPicsartDocs((prev) => [...prev.filter((d) => d.docType !== docType), data as PicsartDoc]);
      toast({ title: "Picsart fertig", description: `${data.label} wurde generiert.` });
    } catch (err: any) {
      toast({ title: "Picsart Fehler", description: err.message || "Bild-Generierung fehlgeschlagen", variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  const runDeepAnalysis = async () => {
    setLoadingAction("deep");
    try {
      const { data, error } = await supabase.functions.invoke("generate-solutions", {
        body: { provider, model, mode: "deep-analysis", loesung },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDeepAnalysis(data);
      toast({ title: "Analyse fertig", description: "Detaillierte Fachanalyse wurde erstellt." });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Analyse fehlgeschlagen", variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  const generatePrompts = async () => {
    setLoadingAction("prompt");
    try {
      const { data, error } = await supabase.functions.invoke("generate-solutions", {
        body: { provider, model, mode: "technical-prompt", loesung },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTechPrompts(data);
      toast({ title: "Prompts erstellt", description: "KI-Prompts für technische Dokumentation wurden generiert." });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Prompt-Generierung fehlgeschlagen", variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  const exportDocument = async () => {
    setLoadingAction("export");
    try {
      const { data, error } = await supabase.functions.invoke("generate-document", {
        body: { loesung, format: exportFormat, provider, model, projektName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content = data.content || "";
      const mimeTypes: Record<string, string> = {
        pdf: "text/markdown", docx: "text/markdown", xlsx: "text/csv", pptx: "application/json",
      };
      const extensions: Record<string, string> = {
        pdf: "md", docx: "md", xlsx: "csv", pptx: "json",
      };
      
      const blob = new Blob([content], { type: mimeTypes[exportFormat] || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${loesung.titel.replace(/\s+/g, "_")}.${extensions[exportFormat] || "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export fertig", description: `Dokument wurde heruntergeladen.` });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Export fehlgeschlagen", variant: "destructive" });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={runDeepAnalysis} disabled={!!loadingAction}>
          {loadingAction === "deep" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Detaillierte Fachanalyse
        </Button>

        <div className="flex gap-1.5 items-center">
          <Select value={exportFormat} onValueChange={setExportFormat}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF/MD</SelectItem>
              <SelectItem value="docx">Anleitung</SelectItem>
              <SelectItem value="xlsx">Stückliste</SelectItem>
              <SelectItem value="pptx">Präsentation</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportDocument} disabled={!!loadingAction}>
            {loadingAction === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportieren
          </Button>
        </div>

        <Button variant="outline" size="sm" className="gap-2" onClick={generatePrompts} disabled={!!loadingAction}>
          {loadingAction === "prompt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          KI-Prompt generieren
        </Button>
      </div>

      {deepAnalysis && (
        <Accordion type="single" collapsible defaultValue="deep">
          <AccordionItem value="deep">
            <AccordionTrigger className="text-sm font-semibold">🔬 Detaillierte Fachanalyse</AccordionTrigger>
            <AccordionContent><DeepAnalysisView analysis={deepAnalysis} /></AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {techPrompts && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">✨ Generierte KI-Prompts</p>
          {techPrompts.rawResponse ? (
            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">{techPrompts.rawResponse}</pre>
          ) : (
            <>
              {techPrompts.zeichnungsPrompt && <PromptCopyCard label="📐 Technische Zeichnung" prompt={techPrompts.zeichnungsPrompt} />}
              {techPrompts.stuecklistePrompt && <PromptCopyCard label="📋 Stückliste (Excel)" prompt={techPrompts.stuecklistePrompt} />}
              {techPrompts.praesentationPrompt && <PromptCopyCard label="📊 Präsentation" prompt={techPrompts.praesentationPrompt} />}
              {techPrompts.montagePrompt && <PromptCopyCard label="🔧 Montage-Anleitung" prompt={techPrompts.montagePrompt} />}
            </>
          )}
        </div>
      )}

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Picsart Technische Dokumentation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Jedes Dokument wird mit einem fachlichen Prompt (DIN/ISO, Maschinenbau) an den Picsart Agent gesendet und als Bild generiert.
          </p>
          <div className="flex flex-wrap gap-2">
            {PICSART_DOCS.map((d) => {
              const isLoading = loadingAction === `picsart-${d.type}`;
              return (
                <Button
                  key={d.type}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => generatePicsartDoc(d.type)}
                  disabled={!!loadingAction}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{d.emoji}</span>}
                  {d.label}
                </Button>
              );
            })}
          </div>

          {picsartDocs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {picsartDocs.map((doc) => (
                <Card key={doc.docType} className="overflow-hidden">
                  <div className="bg-muted aspect-square flex items-center justify-center">
                    <img src={doc.imageUrl} alt={doc.label} className="w-full h-full object-contain" />
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{doc.label}</p>
                      <a href={doc.imageUrl} target="_blank" rel="noopener noreferrer" download>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 font-mono">{doc.prompt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoesungCard({ loesung, provider, model, projektName }: { loesung: Loesung; provider: AIProvider; model?: MonicaModel; projektName?: string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{loesung.titel}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{loesung.beschreibung}</p></CardContent>
      </Card>

      {loesung.komponenten?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Komponentenliste</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bauteil</TableHead><TableHead>Norm</TableHead><TableHead>Material</TableHead><TableHead>Menge</TableHead><TableHead>Preis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loesung.komponenten.map((k, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">{k.norm}</TableCell>
                    <TableCell className="text-sm">{k.material}</TableCell>
                    <TableCell className="font-mono text-sm">{k.menge}</TableCell>
                    <TableCell className="font-mono text-sm">{k.preis}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" defaultValue={["vorteile"]}>
        <AccordionItem value="vorteile">
          <AccordionTrigger className="text-sm font-semibold">✅ Vorteile ({loesung.vorteile?.length || 0})</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5">
              {loesung.vorteile?.map((v, i) => (<li key={i} className="text-sm flex items-start gap-2"><span className="text-engineering-success mt-0.5">•</span> {v}</li>))}
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="nachteile">
          <AccordionTrigger className="text-sm font-semibold">⚠️ Nachteile ({loesung.nachteile?.length || 0})</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5">
              {loesung.nachteile?.map((n, i) => (<li key={i} className="text-sm flex items-start gap-2"><span className="text-accent mt-0.5">•</span> {n}</li>))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {loesung.kosten && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Kostenabschätzung</p>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-xs text-muted-foreground">Material</p><p className="font-mono font-semibold">{loesung.kosten.material}</p></div>
              <div><p className="text-xs text-muted-foreground">Fertigung</p><p className="font-mono font-semibold">{loesung.kosten.fertigung}</p></div>
              <div><p className="text-xs text-muted-foreground">Gesamt</p><p className="font-mono font-bold text-primary">{loesung.kosten.gesamt}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {loesung.cadTipps?.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-primary" /> Solid Edge Tipps</p>
            <ul className="space-y-1">{loesung.cadTipps.map((t, i) => (<li key={i} className="text-sm text-muted-foreground">→ {t}</li>))}</ul>
          </CardContent>
        </Card>
      )}

      <SolutionActions loesung={loesung} provider={provider} model={model} projektName={projektName} />
    </div>
  );
}

function SolutionHistory({ history, onSelect, onDelete }: { 
  history: SavedSolution[]; 
  onSelect: (s: SavedSolution) => void;
  onDelete: (id: string) => void;
}) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Noch keine gespeicherten Lösungen.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map((s) => (
        <Card key={s.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onSelect(s)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{s.projekt_name || s.anforderungen.slice(0, 60)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(s.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                {" · "}{s.loesungen?.length || 0} Varianten
                {s.provider && ` · ${s.provider}`}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Loesung() {
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardState = location.state as { fromDashboard?: boolean; dashboardDraft?: { description?: string; attachments?: Attachment[] } } | null;

  const [projektName, setProjektName] = useState("");
  const [anforderungen, setAnforderungen] = useState(() => dashboardState?.dashboardDraft?.description ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(() => dashboardState?.dashboardDraft?.attachments ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [loesungen, setLoesungen] = useState<Loesung[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>("monica");
  const [monicaModel, setMonicaModel] = useState<MonicaModel>("gpt-4o");
  const [activeTab, setActiveTab] = useState("new");
  const [history, setHistory] = useState<SavedSolution[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<SavedSolution | null>(null);

  const loadHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("solutions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setHistory(data.map(d => ({ ...d, loesungen: (d.loesungen as any) || [] })));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const saveSolution = async (loesungenData: Loesung[], rawResp: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("solutions").insert({
      user_id: user.id,
      projekt_name: projektName || null,
      anforderungen,
      provider,
      loesungen: loesungenData as any,
      raw_response: rawResp,
    } as any);
    loadHistory();
  };

  const deleteSolution = async (id: string) => {
    await supabase.from("solutions").delete().eq("id", id);
    if (selectedHistory?.id === id) setSelectedHistory(null);
    setHistory(prev => prev.filter(s => s.id !== id));
    toast({ title: "Gelöscht", description: "Lösung wurde entfernt." });
  };

  const zurueckZumDashboard = () => {
    navigate("/", { state: { description: anforderungen, attachments } });
  };

  const generate = async () => {
    if (!anforderungen.trim()) {
      toast({ title: "Eingabe fehlt", description: "Bitte beschreiben Sie Ihre Anforderungen.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setLoesungen([]);
    setRawResponse(null);
    setSelectedHistory(null);

    try {
      const images = attachments.filter((a) => a.type === "image").map((a) => a.dataUrl);
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("generate-solutions", {
        body: { projektName, anforderungen, provider, model: provider === "monica" ? monicaModel : undefined, images, userId: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.loesungen) {
        setLoesungen(data.loesungen);
        toast({ title: "Lösungen generiert", description: `${data.loesungen.length} Varianten erstellt.` });
        await saveSolution(data.loesungen, null);
      } else if (data?.rawResponse) {
        setRawResponse(data.rawResponse);
        await saveSolution([], data.rawResponse);
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Generierung fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const viewHistoryItem = (s: SavedSolution) => {
    setSelectedHistory(s);
    setActiveTab("new");
  };

  const displayLoesungen = selectedHistory ? selectedHistory.loesungen : loesungen;
  const displayRaw = selectedHistory ? selectedHistory.raw_response : rawResponse;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        {dashboardState?.fromDashboard && (
          <Button variant="ghost" size="sm" className="mb-3 gap-2" onClick={zurueckZumDashboard}>
            <ArrowLeft className="h-4 w-4" /> Zurück zum Dashboard
          </Button>
        )}
        <h1 className="text-2xl font-bold">Lösungsvorschläge</h1>
        <p className="text-muted-foreground mt-1">KI-generierte Konstruktionslösungen mit Varianten und Alternativen.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new" className="gap-2"><Zap className="h-4 w-4" /> Neue Lösung</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Verlauf ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 mt-4">
          {selectedHistory && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Gespeicherte Lösung vom {new Date(selectedHistory.created_at).toLocaleDateString("de-DE")}</p>
                  <p className="font-medium text-sm mt-1">{selectedHistory.projekt_name || selectedHistory.anforderungen.slice(0, 80)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedHistory(null)}>Neue erstellen</Button>
              </CardContent>
            </Card>
          )}

          {!selectedHistory && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Input placeholder="Projektname (optional)" value={projektName} onChange={(e) => setProjektName(e.target.value)} />
                  </div>
                  <ProviderSelect value={provider} onChange={setProvider} monicaModel={monicaModel} onMonicaModelChange={setMonicaModel} className="w-[160px]" />
                </div>
                <Textarea
                  placeholder="Beschreiben Sie Ihre Anforderungen: Funktion, Belastung, Material, Abmessungen, Einsatzbereich…"
                  rows={5}
                  value={anforderungen}
                  onChange={(e) => setAnforderungen(e.target.value)}
                />
                <RichMediaInput attachments={attachments} onAttachmentsChange={setAttachments} />
                <Button onClick={generate} disabled={isLoading} className="gap-2 bg-primary hover:bg-primary/90">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {isLoading ? "Generiere Lösungen…" : "Lösungen generieren"}
                </Button>
              </CardContent>
            </Card>
          )}

          {isLoading && (
            <Card className="border-primary/20">
              <CardContent className="p-8 text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
                <p className="font-medium">KI analysiert Anforderungen…</p>
                <p className="text-sm text-muted-foreground mt-1">3 Lösungsvarianten werden erstellt</p>
              </CardContent>
            </Card>
          )}

          {displayLoesungen.length > 0 && (
            <Tabs defaultValue={displayLoesungen[0]?.typ || "best"} className="space-y-4">
              <TabsList className="w-full justify-start">
                {displayLoesungen.map((l) => {
                  const Icon = tabIcons[l.typ] || Trophy;
                  return (
                    <TabsTrigger key={l.typ} value={l.typ} className="gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tabLabels[l.typ] || l.titel}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {displayLoesungen.map((l) => (
                <TabsContent key={l.typ} value={l.typ}>
                  <LoesungCard loesung={l} provider={provider} model={provider === "monica" ? monicaModel : undefined} projektName={projektName} />
                </TabsContent>
              ))}
            </Tabs>
          )}

          {displayRaw && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Ergebnis</CardTitle></CardHeader>
              <CardContent><pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">{displayRaw}</pre></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SolutionHistory history={history} onSelect={viewHistoryItem} onDelete={deleteSolution} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
