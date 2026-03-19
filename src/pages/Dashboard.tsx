import { Upload, Search, Layers, BookOpen, PenTool, ClipboardList, ArrowRight, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

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
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            onClick={() => navigate("/analyse")}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Bild oder Skizze hierher ziehen oder <span className="text-primary font-medium">durchsuchen</span>
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG — max. 10 MB</p>
          </div>
          <div className="flex gap-3">
            <Input
              placeholder="Projektbeschreibung eingeben…"
              className="flex-1"
            />
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              Analysieren starten
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
