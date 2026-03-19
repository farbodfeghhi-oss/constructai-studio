import { Sparkles, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function Prompts() {
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">AI-Prompt Generator</h1>
      <p className="text-muted-foreground">Erstellen Sie professionelle Prompts für technische Bild-KIs und CAD-Rendering.</p>
      <Card>
        <CardContent className="p-6 space-y-4">
          <Textarea placeholder="Beschreiben Sie das gewünschte technische Bild…" rows={4} />
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Sparkles className="h-4 w-4" />
            Prompt generieren
          </Button>
        </CardContent>
      </Card>
      <Card className="bg-muted/50">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-3">
            <p className="text-sm font-semibold">Generierter Prompt</p>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <Copy className="h-3 w-3" /> Kopieren
            </Button>
          </div>
          <p className="text-sm text-muted-foreground font-mono leading-relaxed">
            Starten Sie die Generierung, um einen optimierten Prompt zu erhalten…
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
