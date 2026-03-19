import { useState } from "react";
import { Loader2, Trophy, Coins, Zap, ChevronDown, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

const tabIcons: Record<string, typeof Trophy> = { best: Trophy, cheap: Coins, performance: Zap };
const tabLabels: Record<string, string> = { best: "Beste Empfehlung", cheap: "Kostengünstig", performance: "Hochleistung" };

function LoesungCard({ loesung }: { loesung: Loesung }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{loesung.titel}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{loesung.beschreibung}</p>
        </CardContent>
      </Card>

      {/* Komponenten */}
      {loesung.komponenten?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Komponentenliste</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bauteil</TableHead>
                  <TableHead>Norm</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Menge</TableHead>
                  <TableHead>Preis</TableHead>
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

      {/* Vor-/Nachteile */}
      <Accordion type="multiple" defaultValue={["vorteile"]}>
        <AccordionItem value="vorteile">
          <AccordionTrigger className="text-sm font-semibold">
            ✅ Vorteile ({loesung.vorteile?.length || 0})
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5">
              {loesung.vorteile?.map((v, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-engineering-success mt-0.5">•</span> {v}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="nachteile">
          <AccordionTrigger className="text-sm font-semibold">
            ⚠️ Nachteile ({loesung.nachteile?.length || 0})
          </AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-1.5">
              {loesung.nachteile?.map((n, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span> {n}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Kosten */}
      {loesung.kosten && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Kostenabschätzung</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Material</p>
                <p className="font-mono font-semibold">{loesung.kosten.material}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fertigung</p>
                <p className="font-mono font-semibold">{loesung.kosten.fertigung}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gesamt</p>
                <p className="font-mono font-bold text-primary">{loesung.kosten.gesamt}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CAD Tipps */}
      {loesung.cadTipps?.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-primary" /> Solid Edge Tipps
            </p>
            <ul className="space-y-1">
              {loesung.cadTipps.map((t, i) => (
                <li key={i} className="text-sm text-muted-foreground">→ {t}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Loesung() {
  const [projektName, setProjektName] = useState("");
  const [anforderungen, setAnforderungen] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loesungen, setLoesungen] = useState<Loesung[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const generate = async () => {
    if (!anforderungen.trim()) {
      toast({ title: "Eingabe fehlt", description: "Bitte beschreiben Sie Ihre Anforderungen.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setLoesungen([]);
    setRawResponse(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-solutions", {
        body: { projektName, anforderungen },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.loesungen) {
        setLoesungen(data.loesungen);
        toast({ title: "Lösungen generiert", description: `${data.loesungen.length} Varianten erstellt.` });
      } else if (data?.rawResponse) {
        setRawResponse(data.rawResponse);
      }
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Generierung fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lösungsvorschläge</h1>
        <p className="text-muted-foreground mt-1">KI-generierte Konstruktionslösungen mit Varianten und Alternativen.</p>
      </div>

      {/* Input Form */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <Input
            placeholder="Projektname (optional)"
            value={projektName}
            onChange={(e) => setProjektName(e.target.value)}
          />
          <Textarea
            placeholder="Beschreiben Sie Ihre Anforderungen: Funktion, Belastung, Material, Abmessungen, Einsatzbereich…"
            rows={5}
            value={anforderungen}
            onChange={(e) => setAnforderungen(e.target.value)}
          />
          <Button onClick={generate} disabled={isLoading} className="gap-2 bg-primary hover:bg-primary/90">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isLoading ? "Generiere Lösungen…" : "Lösungen generieren"}
          </Button>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card className="border-primary/20">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="font-medium">KI analysiert Anforderungen…</p>
            <p className="text-sm text-muted-foreground mt-1">3 Lösungsvarianten werden erstellt</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {loesungen.length > 0 && (
        <Tabs defaultValue={loesungen[0]?.typ || "best"} className="space-y-4">
          <TabsList className="w-full justify-start">
            {loesungen.map((l) => {
              const Icon = tabIcons[l.typ] || Trophy;
              return (
                <TabsTrigger key={l.typ} value={l.typ} className="gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tabLabels[l.typ] || l.titel}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {loesungen.map((l) => (
            <TabsContent key={l.typ} value={l.typ}>
              <LoesungCard loesung={l} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Raw fallback */}
      {rawResponse && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ergebnis</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">{rawResponse}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
