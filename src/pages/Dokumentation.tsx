import { FileText, Download, CheckSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  { title: "Stückliste-Generator", desc: "Komponentenlisten erstellen und als PDF/CSV exportieren", icon: FileText },
  { title: "Technische Zeichnungen", desc: "Zeichnungsvorlagen mit Maßangaben", icon: Download },
  { title: "DIN/ISO Normen", desc: "Normen-Übersicht und Suche", icon: FileText },
  { title: "Material-Datenblätter", desc: "Werkstoffdaten tabellarisch", icon: FileText },
  { title: "Release-Checkliste", desc: "Fertigungsprüfung Maschinenbau", icon: CheckSquare },
];

export default function Dokumentation() {
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Dokumentation</h1>
      <p className="text-muted-foreground">Technische Unterlagen, Stücklisten und Normen-Referenz.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Card key={s.title} className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
