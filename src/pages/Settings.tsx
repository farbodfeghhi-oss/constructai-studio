import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, KeyRound, CheckCircle2, XCircle, Loader2, RefreshCw, Info, ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type TestResult = { ok: boolean; configured?: boolean; latency?: number; error?: string; status?: number };

export default function SettingsPage() {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-api-key", { body: {} });
      if (error) throw error;
      setResult(data as TestResult);
      if (data?.ok) {
        toast({ title: "Perplexity: Verbindung OK", description: `Antwortzeit: ${data.latency}ms` });
      } else if (!data?.configured) {
        toast({ title: "Kein Key gespeichert", variant: "destructive" });
      } else {
        toast({ title: "Perplexity: Fehler", description: data?.error || "Unbekannter Fehler", variant: "destructive" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Test fehlgeschlagen";
      setResult({ ok: false, error: msg });
      toast({ title: "Test fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-3 gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Zurück zum Dashboard
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" /> API-Schlüssel verwalten
        </h1>
        <p className="text-muted-foreground mt-1">
          Die gesamte AI-Pipeline läuft exklusiv über Perplexity (Multi-Agent: Sonar Pro, Deep Research, Agent API).
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Sichere Schlüsselverwaltung</AlertTitle>
        <AlertDescription>
          API-Keys werden niemals im Browser gespeichert. Zum Aktualisieren schreiben Sie im Chat:
          <code className="block mt-2 bg-muted px-2 py-1 rounded text-xs">„Bitte aktualisiere meinen PERPLEXITY_API_KEY"</code>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Perplexity AI</CardTitle>
                <Badge variant="outline" className="text-engineering-info gap-1">
                  <Sparkles className="h-3 w-3" /> Exklusiver Provider
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Sonar Pro · Sonar Deep Research · Agent API (Claude Opus, GPT-Fallback). Multimodal, Web-Suche, 200K Context.
              </CardDescription>
            </div>
            <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <code className="font-mono bg-muted px-2 py-1 rounded">PERPLEXITY_API_KEY</code>
            {result && (
              <div className="flex items-center gap-1.5">
                {result.ok ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-engineering-success" /><span className="text-engineering-success">OK · {result.latency}ms</span></>
                ) : (
                  <><XCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">{result.configured === false ? "Nicht gespeichert" : `Fehler ${result.status || ""}`}</span></>
                )}
              </div>
            )}
          </div>
          {result && !result.ok && result.error && (
            <p className="text-xs text-destructive bg-destructive/10 px-2 py-1.5 rounded font-mono">{result.error}</p>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 w-full" onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Verbindung testen
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Powered by Perplexity (Multi-Agent)</AlertTitle>
        <AlertDescription>
          Es gibt keine externen Fallbacks oder manuellen Provider-Wechsel mehr. Die Perplexity Agent API entscheidet
          intern über das beste Modell (Sonar Pro, Claude Opus, GPT) – kein Konfigurationsaufwand im Frontend.
        </AlertDescription>
      </Alert>
    </div>
  );
}
