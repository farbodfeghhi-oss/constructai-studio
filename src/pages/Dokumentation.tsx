import { useState } from "react";
import { BookOpen, Database, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { KnowledgeLibrary } from "@/components/KnowledgeLibrary";

const CHECKLIST_SECTIONS = [
  {
    titel: "Konstruktion & CAD",
    items: ["3D-Modell vollständig und fehlerfrei", "Alle Bauteile korrekt benannt", "Baugruppen-Struktur logisch aufgebaut", "Kollisionsprüfung durchgeführt", "Bewegungssimulation getestet (falls relevant)"],
  },
  {
    titel: "Technische Zeichnungen",
    items: ["Alle Maße und Toleranzen eingetragen", "Oberflächenangaben vollständig", "Passungen korrekt spezifiziert", "Schriftfeld ausgefüllt (Datum, Version, Bearbeiter)", "Schnittansichten wo nötig"],
  },
  {
    titel: "Normprüfung & Material",
    items: ["Alle Normteile korrekt referenziert (DIN/ISO)", "Werkstoffauswahl dokumentiert und begründet", "Werkstoffzertifikate angefordert (falls nötig)", "Oberflächenbehandlung spezifiziert"],
  },
  {
    titel: "Fertigung & Montage",
    items: ["Fertigungsverfahren festgelegt", "Biegeradien prüfen (Blechfertigung)", "Montagereihenfolge dokumentiert", "Anzugsdrehmomente festgelegt", "Sonderwerkzeuge identifiziert"],
  },
  {
    titel: "Freigabe",
    items: ["Stückliste vollständig und geprüft", "Kostenabschätzung erstellt", "Technische Review durchgeführt", "Freigabe durch Projektleiter", "Dokumentation an Fertigung übergeben"],
  },
];

export default function Dokumentation() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const totalItems = CHECKLIST_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wissensbasis</h1>
        <p className="text-muted-foreground">
          DIN/ISO Normen, Technische Daten und Release-Checkliste. Hochgeladene Quellen werden automatisch analysiert und bei neuen Projekten berücksichtigt.
        </p>
      </div>

      <Tabs defaultValue="normen">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="normen" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-3.5 w-3.5" /> DIN/ISO Normen
          </TabsTrigger>
          <TabsTrigger value="technisch" className="gap-1.5 text-xs sm:text-sm">
            <Database className="h-3.5 w-3.5" /> Technische Daten
          </TabsTrigger>
          <TabsTrigger value="checkliste" className="gap-1.5 text-xs sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5" /> Release-Checkliste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="normen" className="space-y-4 mt-4">
          <KnowledgeLibrary
            scope="norm"
            uploadLabel="Norm-Quelle hinzufügen (PDF / Bild / URL / Text)"
            searchPlaceholder="Normen durchsuchen – z.B. DIN 933, Sechskant, Blech…"
            emptyHint="Noch keine Normen hochgeladen. Lade ein PDF, Bild, eine URL oder Text hoch."
          />
        </TabsContent>

        <TabsContent value="technisch" className="space-y-4 mt-4">
          <KnowledgeLibrary
            scope="technical"
            uploadLabel="Technische Quelle hinzufügen (PDF / Bild / URL / Text)"
            searchPlaceholder="Technische Daten durchsuchen – z.B. Lager, Motor, Datenblatt…"
            emptyHint="Noch keine technischen Quellen vorhanden. Lade Datenblätter, Kataloge oder Links hoch."
          />
        </TabsContent>

        <TabsContent value="checkliste" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Release-Checkliste <span className="text-sm font-normal text-muted-foreground">({checkedCount}/{totalItems})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {CHECKLIST_SECTIONS.map((sec, si) => (
                  <AccordionItem key={si} value={`s${si}`}>
                    <AccordionTrigger className="text-sm">{sec.titel}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-1">
                        {sec.items.map((it, ii) => {
                          const k = `${si}-${ii}`;
                          return (
                            <label key={k} className="flex items-start gap-2 text-sm cursor-pointer">
                              <Checkbox
                                checked={!!checked[k]}
                                onCheckedChange={(v) => setChecked((p) => ({ ...p, [k]: !!v }))}
                                className="mt-0.5"
                              />
                              <span className={checked[k] ? "line-through text-muted-foreground" : ""}>{it}</span>
                            </label>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
