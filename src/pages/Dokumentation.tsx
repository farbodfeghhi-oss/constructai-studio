import { useState, useEffect, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  FileText, Download, CheckSquare, Search, Plus, Trash2, Copy, ClipboardList,
  BookOpen, FlaskConical, ShieldCheck, Database, Link2, Upload, Sparkles, Loader2, ExternalLink, X, Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ProviderSelect, type AIProvider } from "@/components/ProviderSelect";
import { RichMediaInput } from "@/components/RichMediaInput";
import { type Attachment } from "@/components/AttachmentPreview";

/* ─── Stückliste (BOM) ─── */
interface BomRow {
  id: string; pos: number; name: string; norm: string; material: string; menge: number; preis: string;
}

const INITIAL_BOM: BomRow[] = [
  { id: "1", pos: 1, name: "Sechskantschraube", norm: "DIN 933", material: "8.8 verzinkt", menge: 12, preis: "0,18 €" },
  { id: "2", pos: 2, name: "Sechskantmutter", norm: "DIN 934", material: "8 verzinkt", menge: 12, preis: "0,08 €" },
  { id: "3", pos: 3, name: "Unterlegscheibe", norm: "DIN 125-A", material: "Stahl verzinkt", menge: 24, preis: "0,04 €" },
  { id: "4", pos: 4, name: "Montagewinkel", norm: "—", material: "S235JR", menge: 4, preis: "2,50 €" },
  { id: "5", pos: 5, name: "Grundplatte", norm: "—", material: "S355J2", menge: 1, preis: "18,00 €" },
];

/* ─── Normen-Datenbank ─── */
const NORMEN = [
  { norm: "DIN 933", titel: "Sechskantschrauben mit Gewinde bis Kopf", kategorie: "Befestigung", status: "Aktuell" },
  { norm: "DIN 934", titel: "Sechskantmuttern", kategorie: "Befestigung", status: "Aktuell" },
  { norm: "DIN 125", titel: "Scheiben — Produktklasse A", kategorie: "Befestigung", status: "Aktuell" },
  { norm: "DIN 7984", titel: "Zylinderschrauben mit Innensechskant, niedriger Kopf", kategorie: "Befestigung", status: "Aktuell" },
  { norm: "DIN 6912", titel: "Zylinderschrauben mit Innensechskant und Schlüsselführung", kategorie: "Befestigung", status: "Aktuell" },
  { norm: "ISO 4762", titel: "Zylinderschrauben mit Innensechskant", kategorie: "Befestigung", status: "Aktuell" },
  { norm: "ISO 7380", titel: "Flachkopfschrauben mit Innensechskant", kategorie: "Befestigung", status: "Aktuell" },
  { norm: "DIN 6885", titel: "Passfedern — Nuten — Hohe Form", kategorie: "Maschinenelemente", status: "Aktuell" },
  { norm: "DIN 471", titel: "Sicherungsringe für Wellen", kategorie: "Maschinenelemente", status: "Aktuell" },
  { norm: "DIN 625", titel: "Rillenkugellager", kategorie: "Lager", status: "Aktuell" },
  { norm: "DIN 5480", titel: "Passverzahnungen — Evolventenprofil", kategorie: "Maschinenelemente", status: "Aktuell" },
  { norm: "EN 10025-2", titel: "Warmgewalzte Erzeugnisse aus Baustählen", kategorie: "Material", status: "Aktuell" },
  { norm: "EN 10088-2", titel: "Nichtrostende Stähle — Blech und Band", kategorie: "Material", status: "Aktuell" },
  { norm: "DIN 6930", titel: "Stanzteile aus Stahl — Allgemeintoleranzen", kategorie: "Blech", status: "Aktuell" },
  { norm: "DIN 6935", titel: "Kaltbiegen von Flacherzeugnissen aus Stahl", kategorie: "Blech", status: "Aktuell" },
];

/* ─── Materialdaten ─── */
const MATERIALIEN = [
  { name: "S235JR", gruppe: "Baustahl", reZug: "235 MPa", rm: "360–510 MPa", dichte: "7,85 g/cm³", eModul: "210 GPa", einsatz: "Allgemeiner Stahlbau, Konstruktion" },
  { name: "S355J2", gruppe: "Baustahl", reZug: "355 MPa", rm: "470–630 MPa", dichte: "7,85 g/cm³", eModul: "210 GPa", einsatz: "Hochbelasteter Stahlbau, Krane" },
  { name: "1.4301 (V2A)", gruppe: "Edelstahl", reZug: "190 MPa", rm: "500–700 MPa", dichte: "7,90 g/cm³", eModul: "200 GPa", einsatz: "Lebensmittelindustrie, Chemie" },
  { name: "1.4404 (V4A)", gruppe: "Edelstahl", reZug: "200 MPa", rm: "500–700 MPa", dichte: "8,00 g/cm³", eModul: "200 GPa", einsatz: "Meeresumgebung, Chlor-Beständigkeit" },
  { name: "EN AW-6060", gruppe: "Aluminium", reZug: "150 MPa", rm: "190 MPa", dichte: "2,70 g/cm³", eModul: "69 GPa", einsatz: "Profile, Leichtbau, Gehäuse" },
  { name: "EN AW-7075", gruppe: "Aluminium", reZug: "480 MPa", rm: "560 MPa", dichte: "2,81 g/cm³", eModul: "72 GPa", einsatz: "Luft- und Raumfahrt, hochfest" },
  { name: "PA6 (Nylon)", gruppe: "Kunststoff", reZug: "70 MPa", rm: "85 MPa", dichte: "1,13 g/cm³", eModul: "3,0 GPa", einsatz: "Zahnräder, Gleitlager, Buchsen" },
  { name: "POM (Delrin)", gruppe: "Kunststoff", reZug: "65 MPa", rm: "70 MPa", dichte: "1,41 g/cm³", eModul: "3,1 GPa", einsatz: "Präzisionsteile, Federn, Clips" },
];

/* ─── Release-Checkliste ─── */
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

const CATEGORIES = ["Maschinenelemente", "Blech", "Montage", "Elektro", "Hydraulik", "Pneumatik", "Sonstiges"];

interface DbComponent {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  keywords: string[];
  norm: string | null;
  material: string | null;
  supplier: string | null;
  price: string | null;
  size: string | null;
  url: string | null;
  image_urls: string[];
  file_urls: string[];
  source: string | null;
  created_at: string;
}

export default function Dokumentation() {
  const { toast } = useToast();
  const { user } = useAuth();

  /* BOM state */
  const [bom, setBom] = useState<BomRow[]>(INITIAL_BOM);
  const [newRow, setNewRow] = useState({ name: "", norm: "", material: "", menge: "1", preis: "" });

  /* Normen search */
  const [normenSuche, setNormenSuche] = useState("");
  const filteredNormen = NORMEN.filter(
    (n) =>
      n.norm.toLowerCase().includes(normenSuche.toLowerCase()) ||
      n.titel.toLowerCase().includes(normenSuche.toLowerCase()) ||
      n.kategorie.toLowerCase().includes(normenSuche.toLowerCase())
  );

  /* Material search */
  const [matSuche, setMatSuche] = useState("");
  const filteredMat = MATERIALIEN.filter(
    (m) =>
      m.name.toLowerCase().includes(matSuche.toLowerCase()) ||
      m.gruppe.toLowerCase().includes(matSuche.toLowerCase())
  );

  /* Checklist state */
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const totalItems = CHECKLIST_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  /* Produkt-Datenbank state */
  const [dbComponents, setDbComponents] = useState<DbComponent[]>([]);
  const [dbSearch, setDbSearch] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", description: "", category: "Maschinenelemente", keywords: "",
    norm: "", material: "", supplier: "", price: "", size: "", url: "",
  });
  const [addAttachments, setAddAttachments] = useState<Attachment[]>([]);
  const [aiProvider, setAiProvider] = useState<AIProvider>("perplexity");
  const [analyzing, setAnalyzing] = useState(false);

  const loadComponents = useCallback(async () => {
    if (!user) return;
    setDbLoading(true);
    const { data, error } = await supabase
      .from("components")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setDbComponents(data as DbComponent[]);
    setDbLoading(false);
  }, [user]);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  const filteredDb = dbComponents.filter((c) => {
    const q = dbSearch.toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q) ||
      c.norm?.toLowerCase().includes(q) ||
      c.material?.toLowerCase().includes(q) ||
      c.keywords?.some((k) => k.toLowerCase().includes(q));
  });

  const analyzeWithAI = async () => {
    if (!addForm.url && !addForm.description && addAttachments.length === 0) {
      toast({ title: "Keine Daten", description: "Bitte Link, Beschreibung oder Bilder angeben.", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      const images = addAttachments.filter((a) => a.type === "image").map((a) => a.dataUrl);
      const { data, error } = await supabase.functions.invoke("analyze-component", {
        body: { url: addForm.url, description: addForm.description, images, provider: aiProvider },
      });
      if (error) throw error;
      const s = data.suggestion;
      if (s) {
        setAddForm((prev) => ({
          ...prev,
          name: s.name || prev.name,
          description: s.description || prev.description,
          category: CATEGORIES.includes(s.category) ? s.category : prev.category,
          keywords: s.keywords?.join(", ") || prev.keywords,
          norm: s.norm || prev.norm,
          material: s.material || prev.material,
          supplier: s.supplier || prev.supplier,
          price: s.price || prev.price,
          size: s.size || prev.size,
        }));
        toast({ title: "AI-Vorschläge übernommen", description: "Bitte prüfen und bei Bedarf anpassen." });
      }
    } catch (e) {
      toast({ title: "Analyse fehlgeschlagen", description: e instanceof Error ? e.message : "Fehler", variant: "destructive" });
    }
    setAnalyzing(false);
  };

  const saveComponent = async () => {
    if (!addForm.name.trim() || !user) {
      toast({ title: "Name erforderlich", variant: "destructive" });
      return;
    }
    const imageUrls = addAttachments.filter((a) => a.type === "image").map((a) => a.dataUrl);
    const keywords = addForm.keywords.split(",").map((k) => k.trim()).filter(Boolean);

    const { error } = await supabase.from("components").insert({
      user_id: user.id,
      name: addForm.name,
      description: addForm.description || null,
      category: addForm.category,
      keywords,
      norm: addForm.norm || null,
      material: addForm.material || null,
      supplier: addForm.supplier || null,
      price: addForm.price || null,
      size: addForm.size || null,
      url: addForm.url || null,
      image_urls: imageUrls,
      file_urls: [],
      source: "manual",
    });

    if (error) {
      toast({ title: "Fehler beim Speichern", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Gespeichert", description: `${addForm.name} wurde zur Datenbank hinzugefügt.` });
    setAddForm({ name: "", description: "", category: "Maschinenelemente", keywords: "", norm: "", material: "", supplier: "", price: "", size: "", url: "" });
    setAddAttachments([]);
    setShowAddForm(false);
    loadComponents();
  };

  const deleteComponent = async (id: string) => {
    const { error } = await supabase.from("components").delete().eq("id", id);
    if (!error) {
      setDbComponents((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Gelöscht" });
    }
  };

  const addBomRow = () => {
    if (!newRow.name.trim()) {
      toast({ title: "Bezeichnung erforderlich", description: "Bitte geben Sie eine Bezeichnung ein.", variant: "destructive" });
      return;
    }
    const row: BomRow = {
      id: Date.now().toString(), pos: bom.length + 1,
      name: newRow.name, norm: newRow.norm || "—", material: newRow.material || "—",
      menge: parseInt(newRow.menge) || 1, preis: newRow.preis || "—",
    };
    setBom((prev) => [...prev, row]);
    setNewRow({ name: "", norm: "", material: "", menge: "1", preis: "" });
    toast({ title: "Hinzugefügt", description: `${row.name} wurde zur Stückliste hinzugefügt.` });
  };

  const removeBomRow = (id: string) => {
    setBom((prev) => prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, pos: i + 1 })));
  };

  const exportBomCSV = () => {
    const header = "Pos;Bezeichnung;Norm;Material;Menge;Preis";
    const rows = bom.map((r) => `${r.pos};${r.name};${r.norm};${r.material};${r.menge};${r.preis}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "stueckliste.csv"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportiert", description: "Stückliste als CSV heruntergeladen." });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dokumentation</h1>
        <p className="text-muted-foreground">
          Technische Unterlagen, Stücklisten, Normen-Referenz, Produkt-Datenbank und Release-Checkliste.
        </p>
      </div>

      <Tabs defaultValue="stueckliste">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="stueckliste" className="gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="h-3.5 w-3.5" /> Stückliste
          </TabsTrigger>
          <TabsTrigger value="normen" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-3.5 w-3.5" /> DIN/ISO Normen
          </TabsTrigger>
          <TabsTrigger value="material" className="gap-1.5 text-xs sm:text-sm">
            <FlaskConical className="h-3.5 w-3.5" /> Materialien
          </TabsTrigger>
          <TabsTrigger value="produkte" className="gap-1.5 text-xs sm:text-sm">
            <Database className="h-3.5 w-3.5" /> Produkt-Datenbank
          </TabsTrigger>
          <TabsTrigger value="checkliste" className="gap-1.5 text-xs sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5" /> Release-Checkliste
          </TabsTrigger>
        </TabsList>

        {/* ── Stückliste ── */}
        <TabsContent value="stueckliste" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-lg">Stückliste / Bill of Materials</CardTitle>
                <Button size="sm" variant="secondary" className="gap-1" onClick={exportBomCSV}>
                  <Download className="h-3.5 w-3.5" /> CSV Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Pos</TableHead>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead>Norm</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="w-16 text-right">Menge</TableHead>
                      <TableHead className="w-20 text-right">Preis</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bom.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.pos}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.norm}</Badge></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.material}</TableCell>
                        <TableCell className="text-right font-mono">{r.menge}</TableCell>
                        <TableCell className="text-right font-mono">{r.preis}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBomRow(r.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-4 pt-4 border-t border-border">
                <Input placeholder="Bezeichnung *" value={newRow.name} onChange={(e) => setNewRow((p) => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Norm" value={newRow.norm} onChange={(e) => setNewRow((p) => ({ ...p, norm: e.target.value }))} />
                <Input placeholder="Material" value={newRow.material} onChange={(e) => setNewRow((p) => ({ ...p, material: e.target.value }))} />
                <Input placeholder="Menge" type="number" value={newRow.menge} onChange={(e) => setNewRow((p) => ({ ...p, menge: e.target.value }))} />
                <Input placeholder="Preis" value={newRow.preis} onChange={(e) => setNewRow((p) => ({ ...p, preis: e.target.value }))} />
                <Button className="gap-1" onClick={addBomRow} disabled={!newRow.name.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Normen ── */}
        <TabsContent value="normen" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Norm suchen (z.B. DIN 933, Schraube, Blech)…" value={normenSuche} onChange={(e) => setNormenSuche(e.target.value)} className="pl-9" />
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Norm</TableHead>
                      <TableHead>Titel</TableHead>
                      <TableHead className="w-36">Kategorie</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNormen.map((n) => (
                      <TableRow key={n.norm}>
                        <TableCell className="font-mono font-medium text-sm">{n.norm}</TableCell>
                        <TableCell>{n.titel}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{n.kategorie}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs text-green-600 border-green-300">{n.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {filteredNormen.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Keine Normen gefunden.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Materialien ── */}
        <TabsContent value="material" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Material suchen (z.B. S235, Edelstahl, Aluminium)…" value={matSuche} onChange={(e) => setMatSuche(e.target.value)} className="pl-9" />
          </div>
          <div className="grid gap-4">
            {filteredMat.map((m) => (
              <Card key={m.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{m.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">{m.gruppe}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                    <div><p className="text-muted-foreground text-xs">Streckgrenze</p><p className="font-mono font-medium">{m.reZug}</p></div>
                    <div><p className="text-muted-foreground text-xs">Zugfestigkeit</p><p className="font-mono font-medium">{m.rm}</p></div>
                    <div><p className="text-muted-foreground text-xs">Dichte</p><p className="font-mono font-medium">{m.dichte}</p></div>
                    <div><p className="text-muted-foreground text-xs">E-Modul</p><p className="font-mono font-medium">{m.eModul}</p></div>
                    <div className="col-span-2 sm:col-span-1"><p className="text-muted-foreground text-xs">Einsatzgebiet</p><p className="text-sm">{m.einsatz}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredMat.length === 0 && <p className="text-center text-muted-foreground py-8">Kein Material gefunden.</p>}
          </div>
        </TabsContent>

        {/* ── Produkt-Datenbank ── */}
        <TabsContent value="produkte" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Produkte durchsuchen…" value={dbSearch} onChange={(e) => setDbSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <ProviderSelect value={aiProvider} onChange={setAiProvider} className="w-[150px]" />
              <Button className="gap-1.5" onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showAddForm ? "Schließen" : "Produkt hinzufügen"}
              </Button>
            </div>
          </div>

          {/* Add form */}
          {showAddForm && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" /> Produkt zur Datenbank hinzufügen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Produkt-Link (optional)</label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="https://..." value={addForm.url} onChange={(e) => setAddForm((p) => ({ ...p, url: e.target.value }))} className="pl-9" />
                        </div>
                      </div>
                      <Button variant="secondary" className="gap-1.5 mt-5" onClick={analyzeWithAI} disabled={analyzing}>
                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        AI-Analyse
                      </Button>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Beschreibung</label>
                      <Textarea placeholder="Technische Beschreibung des Produkts…" value={addForm.description} onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))} rows={3} />
                    </div>

                    <RichMediaInput attachments={addAttachments} onAttachmentsChange={setAddAttachments} acceptAudio={false} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                    <Input placeholder="Produktname" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Kategorie</label>
                    <Select value={addForm.category} onValueChange={(v) => setAddForm((p) => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Keywords (kommagetrennt)</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Schraube, M8, DIN933" value={addForm.keywords} onChange={(e) => setAddForm((p) => ({ ...p, keywords: e.target.value }))} className="pl-9" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Norm</label>
                    <Input placeholder="DIN/ISO…" value={addForm.norm} onChange={(e) => setAddForm((p) => ({ ...p, norm: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Material</label>
                    <Input placeholder="Stahl, Edelstahl…" value={addForm.material} onChange={(e) => setAddForm((p) => ({ ...p, material: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Lieferant</label>
                    <Input placeholder="Hersteller/Lieferant" value={addForm.supplier} onChange={(e) => setAddForm((p) => ({ ...p, supplier: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Preis</label>
                    <Input placeholder="0,00 €" value={addForm.price} onChange={(e) => setAddForm((p) => ({ ...p, price: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Größe</label>
                    <Input placeholder="M8x30, Ø20…" value={addForm.size} onChange={(e) => setAddForm((p) => ({ ...p, size: e.target.value }))} />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>Abbrechen</Button>
                  <Button onClick={saveComponent} disabled={!addForm.name.trim()} className="gap-1.5">
                    <Download className="h-4 w-4" /> Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product list */}
          <Card>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{filteredDb.length}</span> Produkte in der Datenbank
              </p>
            </div>
            <div className="overflow-auto">
              {dbLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filteredDb.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Keine Produkte gefunden.</p>
                  <p className="text-xs mt-1">Fügen Sie Produkte über das Formular oder die KI-Websuche hinzu.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Norm</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Keywords</TableHead>
                      <TableHead>Quelle</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDb.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {c.name}
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 text-primary" /></a>
                            )}
                          </div>
                          {c.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{c.category}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{c.norm || "—"}</TableCell>
                        <TableCell className="text-xs">{c.material || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.keywords?.slice(0, 3).map((k) => (
                              <Badge key={k} variant="outline" className="text-[10px] px-1.5">{k}</Badge>
                            ))}
                            {(c.keywords?.length || 0) > 3 && <Badge variant="outline" className="text-[10px] px-1.5">+{c.keywords.length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {c.source === "web_search" ? "🔍 Web" : c.source === "ai_import" ? "🤖 AI" : "✏️ Manuell"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteComponent(c.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Release-Checkliste ── */}
        <TabsContent value="checkliste" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Release-Checkliste Maschinenbau</CardTitle>
                <Badge variant={checkedCount === totalItems ? "default" : "secondary"}>
                  {checkedCount} / {totalItems}
                </Badge>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Accordion type="multiple" defaultValue={CHECKLIST_SECTIONS.map((_, i) => `sec-${i}`)}>
                {CHECKLIST_SECTIONS.map((sec, si) => {
                  const sectionChecked = sec.items.filter((_, ii) => checked[`${si}-${ii}`]).length;
                  return (
                    <AccordionItem key={si} value={`sec-${si}`}>
                      <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                          {sec.titel}
                          <Badge variant="outline" className="text-[10px] px-1.5">{sectionChecked}/{sec.items.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pt-1">
                        {sec.items.map((item, ii) => {
                          const key = `${si}-${ii}`;
                          return (
                            <label key={key} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                              <Checkbox checked={!!checked[key]} onCheckedChange={(v) => setChecked((p) => ({ ...p, [key]: !!v }))} />
                              <span className={`text-sm ${checked[key] ? "line-through text-muted-foreground" : ""}`}>{item}</span>
                            </label>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
