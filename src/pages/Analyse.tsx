import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Analyse() {
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Bild-Analyse</h1>
      <p className="text-muted-foreground">KI-gestützte Erkennung technischer Komponenten aus Bildern und Skizzen.</p>
      <Card className="border-2 border-dashed border-primary/30">
        <CardContent className="p-12 text-center">
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Bild hierher ziehen oder klicken zum Hochladen</p>
          <p className="text-xs text-muted-foreground/60 mt-2">JPG, PNG — max. 10 MB</p>
        </CardContent>
      </Card>
    </div>
  );
}
