import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, KeyRound, CheckCircle2, XCircle, Loader2, RefreshCw, Plus, Info, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Provider = {
  id: string;
  name: string;
  envName: string;
  description: string;
  helpUrl: string;
  badge?: string;
  color: string;
};

const ACTIVE_PROVIDERS: Provider[] = [
  { id: "perplexity", name: "Perplexity AI", envName: "PERPLEXITY_API_KEY", description: "Echtzeit-Websuche und Recherche (sonar-pro Modell).", helpUrl: "https://www.perplexity.ai/settings/api", badge: "Aktiv", color: "text-engineering-info" },
  { id: "monica", name: "Monica AI", envName: "MONICA_API_KEY", description: "Multi-Modell Plattform (GPT-4o, Claude, Gemini, DeepSeek).", helpUrl: "https://platform.monica.im/", badge: "Aktiv", color: "text-engineering-success" },
];

const OPTIONAL_PROVIDERS: Provider[] = [
  { id: "openai", name: "OpenAI", envName: "OPENAI_API_KEY", description: "GPT-4o, GPT-4 Turbo, o1 Modelle direkt.", helpUrl: "https://platform.openai.com/api-keys", color: "text-foreground" },
  { id: "anthropic", name: "Anthropic Claude", envName: "ANTHROPIC_API_KEY", description: "Claude Sonnet & Opus direkt von Anthropic.", helpUrl: "https://console.anthropic.com/settings/keys", color: "text-foreground" },
  { id: "gemini", name: "Google Gemini", envName: "GEMINI_API_KEY", description: "Kostenlose Nutzung: Flash-Modelle ohne Pro-Quota.", helpUrl: "https://aistudio.google.com/apikey", color: "text-foreground" },
  { id: "groq", name: "Groq", envName: "GROQ_API_KEY", description: "Extrem schnelle Inferenz für Llama & Mixtral.", helpUrl: "https://console.groq.com/keys", color: "text-foreground" },
  { id: "deepseek", name: "DeepSeek", envName: "DEEPSEEK_API_KEY", description: "DeepSeek V3 & R1 (Reasoning) direkt.", helpUrl: "https://platform.deepseek.com/api_keys", color: "text-foreground" },
];

type TestResult = { ok: boolean; configured?: boolean; latency?: number; error?: string; status?: number };

function ProviderCard({ provider, onManage }: { provider: Provider; onManage: (envName: string) => void }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-api-key", {
        body: { provider: provider.id },
      });
      if (error) throw error;
      setResult(data as TestResult);
      if (data?.ok) {
        toast({ title: `${provider.name}: Verbindung OK`, description: `Antwortzeit: ${data.latency}ms` });
      } else if (!data?.configured) {
        toast({ title: `${provider.name}: Kein Key gespeichert`, variant: "destructive" });
      } else {
        toast({ title: `${provider.name}: Fehler`, description: data?.error || "Unbekannter Fehler", variant: "destructive" });
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{provider.name}</CardTitle>
              {provider.badge && <Badge variant="outline" className={provider.color}>{provider.badge}</Badge>}
            </div>
            <CardDescription className="text-xs">{provider.description}</CardDescription>
          </div>
          <a href={provider.helpUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <code className="font-mono bg-muted px-2 py-1 rounded">{provider.envName}</code>
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Testen
          </Button>
          <Button size="sm" className="gap-1.5 flex-1" onClick={() => onManage(provider.envName)}>
            <KeyRound className="h-3.5 w-3.5" />
            Key speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();

  const handleManageKey = (envName: string) => {
    // Open Lovable Cloud secrets management
    toast({
      title: "API-Key speichern",
      description: `Bitte fragen Sie im Chat: "Bitte aktualisiere meinen ${envName} Key" — Lovable öffnet dann das sichere Eingabeformular.`,
      duration: 8000,
    });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-3 gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Zurück zum Dashboard
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-primary" /> API-Schlüssel verwalten
        </h1>
        <p className="text-muted-foreground mt-1">
          Verwalten Sie Ihre KI-Provider API-Keys. Alle Schlüssel werden sicher serverseitig gespeichert.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Sichere Schlüsselverwaltung</AlertTitle>
        <AlertDescription>
          API-Keys werden niemals im Browser gespeichert. Zum Speichern oder Aktualisieren schreiben Sie im Chat z.B.:
          <code className="block mt-2 bg-muted px-2 py-1 rounded text-xs">„Bitte aktualisiere meinen PERPLEXITY_API_KEY"</code>
          Es öffnet sich dann ein sicheres Eingabeformular.
        </AlertDescription>
      </Alert>

      {/* Active Providers */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-engineering-success" /> Aktive KI-Anbieter
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ACTIVE_PROVIDERS.map((p) => (
            <ProviderCard key={p.id} provider={p} onManage={handleManageKey} />
          ))}
        </div>
      </div>

      {/* Optional Providers */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Plus className="h-5 w-5 text-muted-foreground" /> Weitere Anbieter (optional)
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Fügen Sie zusätzliche KI-Provider hinzu. Diese können in zukünftigen Versionen ausgewählt werden.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {OPTIONAL_PROVIDERS.map((p) => (
            <ProviderCard key={p.id} provider={p} onManage={handleManageKey} />
          ))}
        </div>
      </div>
    </div>
  );
}
