import { useState, useEffect, useCallback } from "react";
import { Loader2, Trophy, Coins, Zap, Wrench, ArrowLeft, History, Trash2, ChevronDown } from "lucide-react";
import { ProviderSelect, type AIProvider } from "@/components/ProviderSelect";
import { RichMediaInput } from "@/components/RichMediaInput";
import { type Attachment } from "@/components/AttachmentPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

const tabIcons: Record<string, typeof Trophy> = { best: Trophy, cheap: Coins, performance: Zap };
const tabLabels: Record<string, string> = { best: "Beste Empfehlung", cheap: "Kostengünstig", performance: "Hochleistung" };

function LoesungCard({ loesung }: { loesung: Loesung }) {
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
      const { data, error } = await supabase.functions.invoke("generate-solutions", {
        body: { projektName, anforderungen, provider, images },
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
                  <ProviderSelect value={provider} onChange={setProvider} className="w-[160px]" />
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
                <TabsContent key={l.typ} value={l.typ}><LoesungCard loesung={l} /></TabsContent>
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
