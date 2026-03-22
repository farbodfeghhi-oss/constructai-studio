import { useEffect, useState } from "react";
import { Upload, Search, Layers, BookOpen, PenTool, ClipboardList, ArrowRight, MoreHorizontal, ImagePlus, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RichMediaInput } from "@/components/RichMediaInput";
import { type Attachment } from "@/components/AttachmentPreview";
import { useLocation, useNavigate } from "react-router-dom";

const quickActions = [
  { title: "Normteil-Suche", desc: "DIN/ISO Standardteile finden", icon: Search, route: "/komponenten" },
  { title: "Material-Beratung", desc: "Werkstoff-Empfehlungen", icon: Layers, route: "/loesung" },
  { title: "Solid Edge Tipps", desc: "CAD Best-Practices", icon: PenTool, route: "/dokumentation" },
  { title: "DIN/ISO Normen", desc: "Normen nachschlagen", icon: BookOpen, route: "/dokumentation" },
  { title: "Blech-Design", desc: "Sheet Metal Workflow", icon: PenTool, route: "/loesung" },
  { title: "Stückliste erstellen", desc: "BOM generieren", icon: ClipboardList, route: "/dokumentation" },
];

const recentProjects = [
  { name: "Winkelkonsole V2", status: "In Arbeit", date: "18.03.2026", type: "Blechkonstruktion" },
  { name: "Getriebegehäuse", status: "Abgeschlossen", date: "15.03.2026", type: "Maschinenbau" },
  { name: "Montagevorrichtung", status: "Review", date: "12.03.2026", type: "Vorrichtungsbau" },
  { name: "Schaltschrankplatte", status: "In Arbeit", date: "10.03.2026", type: "Schaltschrankbau" },
];

const statusColor: Record<string, string> = {
  "In Arbeit": "bg-engineering-info/15 text-engineering-info border-engineering-info/30",
  "Abgeschlossen": "bg-engineering-success/15 text-engineering-success border-engineering-success/30",
  "Review": "bg-accent/15 text-accent border-accent/30",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [beschreibung, setBeschreibung] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    const state = location.state as { description?: string; attachments?: Attachment[] } | null;
    if (!state) return;
    setBeschreibung(state.description ?? "");
    setAttachments(state.attachments ?? []);
  }, [location.state]);

  const weiterZumPassendenBereich = () => {
    const nextState = {
      fromDashboard: true,
      dashboardDraft: {
        description: beschreibung,
        attachments,
      },
    };

    navigate(beschreibung.trim() ? "/loesung" : "/analyse", { state: nextState });
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero Upload Card */}
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader>
          <CardTitle className="text-2xl">
            Willkommen bei <span className="text-primary">MechAI</span>
          </CardTitle>
          <CardDescription className="text-base">
            Laden Sie ein technisches Bild hoch oder beschreiben Sie Ihr Projekt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background/70 p-5 space-y-4">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Upload className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Projektbeschreibung und Bilder direkt hier vorbereiten</p>
                <p>Mit Beschreibung geht es weiter zu Lösungsvorschlägen, ohne Beschreibung direkt zur Bild-Analyse.</p>
              </div>
            </div>

            <RichMediaInput
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              acceptFiles={false}
              acceptAudio={false}
              acceptScreenshot={true}
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {attachments.filter((item) => item.type === "image").length} Bild(er)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                  <FileText className="h-3.5 w-3.5" />
                  Entwurf bleibt beim Zurückgehen erhalten
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Input
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Projektbeschreibung eingeben…"
              className="flex-1"
            />
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={weiterZumPassendenBereich}
              disabled={!beschreibung.trim() && attachments.length === 0}
            >
              {beschreibung.trim() ? "Mit Beschreibung weiter" : "Zur Bild-Analyse"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
              onClick={() => navigate(action.route)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Aktuelle Projekte</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Letzte Änderung</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((project) => (
                <TableRow key={project.name} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">{project.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[project.status]}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{project.date}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
