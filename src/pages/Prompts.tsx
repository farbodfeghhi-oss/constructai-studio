import { useState } from "react";
import { Sparkles, Copy, Check, Save, Trash2, BookTemplate, Loader2 } from "lucide-react";
import { ProviderSelect, type AIProvider } from "@/components/ProviderSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Template {
  id: string;
  name: string;
  beschreibung: string;
  prompt: string;
}

const EXAMPLE_TEMPLATES: Template[] = [
  {
    id: "t1",
    name: "Montagewinkel",
    beschreibung: "Montagewinkel aus Stahl mit M8 Schrauben, isometrische Ansicht",
    prompt: "Photorealistic CAD rendering of a steel S235 mounting bracket 100x100x5mm with 4x M8 hex bolts DIN 933 A2-70, isometric view at 30° angle, studio lighting with soft shadows, brushed metal surface, white gradient background, 8K ultra-detailed, sharp focus, engineering visualization",
  },
  {
    id: "t2",
    name: "Kugellagerbaugruppe",
    beschreibung: "Explosionszeichnung eines Kugellagers mit allen Einzelteilen",
    prompt: "Technical exploded view rendering of a deep groove ball bearing 6205-2RS, showing inner ring, outer ring, balls, cage, and rubber seals separated along central axis, precise engineering CAD style, neutral gray background, dimension lines visible, photorealistic metal textures, 8K sharp focus",
  },
  {
    id: "t3",
    name: "Blechgehäuse",
    beschreibung: "Schaltschrankgehäuse aus Edelstahl mit Lüftungsschlitzen",
    prompt: "Photorealistic 3D rendering of a stainless steel V2A electrical enclosure 600x400x200mm with ventilation louvers on side panels, DIN rail mounted inside, IP55 rated, isometric front-open view showing interior layout, industrial studio lighting, white background, 8K ultra-detailed engineering visualization",
  },
];

export default function Prompts() {
  const [beschreibung, setBeschreibung] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [templates, setTemplates] = useState<Template[]>(EXAMPLE_TEMPLATES);
  const [templateName, setTemplateName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const { toast } = useToast();
  const [provider, setProvider] = useState<AIProvider>("perplexity");

  const generatePrompt = async () => {
    if (!beschreibung.trim()) {
      toast({ title: "Fehler", description: "Bitte geben Sie eine Beschreibung ein.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setGeneratedPrompt("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-prompt", {
        body: { beschreibung, provider },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Fehler", description: data.error, variant: "destructive" });
      } else {
        setGeneratedPrompt(data.prompt);
        setShowSave(true);
      }
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message || "Prompt-Generierung fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    toast({ title: "Kopiert!", description: "Prompt in die Zwischenablage kopiert." });
    setTimeout(() => setCopied(false), 2000);
  };

  const saveTemplate = () => {
    if (!templateName.trim() || !generatedPrompt) return;
    const newTemplate: Template = {
      id: `custom-${Date.now()}`,
      name: templateName,
      beschreibung,
      prompt: generatedPrompt,
    };
    setTemplates((prev) => [newTemplate, ...prev]);
    setTemplateName("");
    setShowSave(false);
    toast({ title: "Gespeichert", description: `Vorlage "${templateName}" wurde gespeichert.` });
  };

  const loadTemplate = (t: Template) => {
    setBeschreibung(t.beschreibung);
    setGeneratedPrompt(t.prompt);
    setShowSave(false);
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast({ title: "Gelöscht", description: "Vorlage entfernt." });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI-Prompt Generator</h1>
          <p className="text-muted-foreground">
            Erstellen Sie professionelle Prompts für technische Bild-KIs und CAD-Rendering.
          </p>
        </div>
        <ProviderSelect value={provider} onChange={setProvider} className="w-[160px]" />
      </div>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <Textarea
            placeholder="Beschreiben Sie das gewünschte technische Bild, z.B. 'Montagewinkel aus S235 Stahl mit M8 Schrauben, isometrische Ansicht'…"
            rows={4}
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
          <Button onClick={generatePrompt} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isLoading ? "Wird generiert…" : "Prompt generieren"}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Prompt */}
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-3">
            <p className="text-sm font-semibold">Generierter Prompt</p>
            {generatedPrompt && (
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={copyToClipboard}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Kopiert" : "Kopieren"}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">
            {generatedPrompt || "Starten Sie die Generierung, um einen optimierten Prompt zu erhalten…"}
          </p>

          {/* Save as template */}
          {showSave && generatedPrompt && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Input
                placeholder="Vorlagenname…"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="max-w-xs"
              />
              <Button variant="secondary" size="sm" className="gap-1" onClick={saveTemplate} disabled={!templateName.trim()}>
                <Save className="h-3 w-3" /> Speichern
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Library */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookTemplate className="h-5 w-5" /> Vorlagen-Bibliothek
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Vorlagen gespeichert.</p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
              >
                <button className="flex-1 text-left" onClick={() => loadTemplate(t)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{t.name}</span>
                    {t.id.startsWith("custom-") && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Eigene</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{t.beschreibung}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTemplate(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
