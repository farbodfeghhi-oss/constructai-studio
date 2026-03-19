import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function Loesung() {
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Lösungsvorschläge</h1>
      <p className="text-muted-foreground">KI-generierte Konstruktionslösungen mit Varianten und Alternativen.</p>
      <Card>
        <CardContent className="p-6 space-y-4">
          <Input placeholder="Projektname" />
          <Textarea placeholder="Beschreiben Sie Ihre Anforderungen…" rows={4} />
          <Button className="bg-primary hover:bg-primary/90">Lösungen generieren</Button>
        </CardContent>
      </Card>
      <Tabs defaultValue="best">
        <TabsList>
          <TabsTrigger value="best">Beste Empfehlung</TabsTrigger>
          <TabsTrigger value="cheap">Kostengünstig</TabsTrigger>
          <TabsTrigger value="perf">Hochleistung</TabsTrigger>
        </TabsList>
        <TabsContent value="best">
          <Card><CardContent className="p-6 text-muted-foreground">Starten Sie eine Analyse, um Lösungsvorschläge zu erhalten.</CardContent></Card>
        </TabsContent>
        <TabsContent value="cheap">
          <Card><CardContent className="p-6 text-muted-foreground">Kostengünstige Alternative wird hier angezeigt.</CardContent></Card>
        </TabsContent>
        <TabsContent value="perf">
          <Card><CardContent className="p-6 text-muted-foreground">Hochleistungs-Variante wird hier angezeigt.</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
