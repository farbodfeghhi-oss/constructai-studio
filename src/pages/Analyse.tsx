import { useState, useCallback } from "react";
import { Upload, Loader2, AlertTriangle, CheckCircle, Info, ArrowRight, Wrench, RefreshCw } from "lucide-react";
import { ProviderSelect, type AIProvider } from "@/components/ProviderSelect";
import { RichMediaInput } from "@/components/RichMediaInput";
import { type Attachment } from "@/components/AttachmentPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AnalysisResult {
  erkannteTeile: { name: string; norm: string; material: string; groesse: string }[];
  technischeAnalyse: { material: string; norm: string; einsatz: string };
  probleme: { beschreibung: string; schweregrad: string }[];
  alternativen: { name: string; vorteil: string }[];
  naechsteSchritte: string[];
  rawResponse?: string;
}

const severityIcon: Record<string, typeof AlertTriangle> = {
  kritisch: AlertTriangle,
  warnung: AlertTriangle,
  info: Info,
};

const severityClass: Record<string, string> = {
  kritisch: "text-destructive",
  warnung: "text-accent",
  info: "text-engineering-info",
};

export default function Analyse() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [provider, setProvider] = useState<AIProvider>("perplexity");

  const hasImages = attachments.some((a) => a.type === "image");

  const analyzeImage = async () => {
    const images = attachments.filter((a) => a.type === "image").map((a) => a.dataUrl);
    if (images.length === 0) return;

    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-image", {
        body: { images, provider },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data.analysis);
      toast({ title: "Analyse abgeschlossen", description: "Komponenten erfolgreich erkannt." });
    } catch (err: any) {
      toast({ title: "Analysefehler", description: err.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setAttachments([]);
    setResult(null);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bild-Analyse</h1>
          <p className="text-muted-foreground mt-1">KI-gestützte Erkennung technischer Komponenten aus Bildern und Skizzen.</p>
        </div>
        <ProviderSelect value={provider} onChange={setProvider} className="w-[160px]" />
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <RichMediaInput
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            acceptFiles={true}
            acceptAudio={true}
            acceptScreenshot={true}
          />

          {hasImages && (
            <div className="flex gap-2">
              <Button onClick={analyzeImage} disabled={isAnalyzing} className="gap-2 bg-primary hover:bg-primary/90">
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                {isAnalyzing ? "Analysiere…" : `${attachments.filter((a) => a.type === "image").length} Bild(er) analysieren`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={isAnalyzing}>
                <RefreshCw className="h-4 w-4 mr-2" /> Zurücksetzen
              </Button>
            </div>
          )}

          {!hasImages && attachments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Laden Sie Bilder hoch, nehmen Sie ein Foto auf oder machen Sie einen Screenshot zur Analyse.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {isAnalyzing && (
        <Card className="border-primary/20">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="font-medium">KI analysiert das Bild…</p>
            <p className="text-sm text-muted-foreground mt-1">Erkennung von Komponenten, Materialien und Normen</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !result.rawResponse && (
        <div className="space-y-4">
          {result.erkannteTeile?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-engineering-success" />
                  Erkannte Komponenten
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Komponente</TableHead>
                      <TableHead>Norm</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Größe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.erkannteTeile.map((teil, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{teil.name}</TableCell>
                        <TableCell className="font-mono text-sm">{teil.norm}</TableCell>
                        <TableCell>{teil.material}</TableCell>
                        <TableCell className="font-mono text-sm">{teil.groesse}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {result.technischeAnalyse && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Technische Analyse</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Material</p>
                    <p className="font-medium font-mono mt-1">{result.technischeAnalyse.material}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Norm</p>
                    <p className="font-medium font-mono mt-1">{result.technischeAnalyse.norm}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Einsatz</p>
                    <p className="font-medium mt-1">{result.technischeAnalyse.einsatz}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {result.probleme?.length > 0 && (
            <Card className="border-accent/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  Erkannte Probleme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.probleme.map((p, i) => {
                  const Icon = severityIcon[p.schweregrad] || Info;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${severityClass[p.schweregrad] || ""}`} />
                      <div>
                        <p className="text-sm">{p.beschreibung}</p>
                        <Badge variant="outline" className="mt-1 text-[10px]">{p.schweregrad}</Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {result.alternativen?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Empfohlene Alternativen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.alternativen.map((alt, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                    <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{alt.name}</p>
                      <p className="text-xs text-muted-foreground">{alt.vorteil}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.naechsteSchritte?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nächste Schritte</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {result.naechsteSchritte.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm mt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {result?.rawResponse && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Analyse-Ergebnis</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">{result.rawResponse}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
