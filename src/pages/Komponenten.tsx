import { useState, useMemo } from "react";
import { Search, Star, Download, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Komponente {
  id: number;
  name: string;
  norm: string;
  material: string;
  kategorie: string;
  groesse: string;
  belastung: string;
  preis: string;
  lieferant: string;
  cadLink: string;
}

const sampleData: Komponente[] = [
  { id: 1, name: "Sechskantschraube", norm: "DIN 933", material: "Stahl 8.8", kategorie: "Maschinenelemente", groesse: "M8x30", belastung: "Statisch", preis: "0,12 €", lieferant: "Würth", cadLink: "#" },
  { id: 2, name: "Zylinderschraube", norm: "DIN 912", material: "Edelstahl A2", kategorie: "Maschinenelemente", groesse: "M6x25", belastung: "Statisch", preis: "0,18 €", lieferant: "Bossard", cadLink: "#" },
  { id: 3, name: "Winkelverbinder", norm: "DIN 1028", material: "Stahl S235", kategorie: "Montage", groesse: "60x60x6", belastung: "Statisch", preis: "2,40 €", lieferant: "Hilti", cadLink: "#" },
  { id: 4, name: "Flanschlager", norm: "DIN 504", material: "Grauguss", kategorie: "Maschinenelemente", groesse: "Ø30", belastung: "Dynamisch", preis: "18,50 €", lieferant: "SKF", cadLink: "#" },
  { id: 5, name: "Blechwinkel", norm: "EN 10143", material: "Aluminium AlMg3", kategorie: "Blech", groesse: "40x40x2", belastung: "Statisch", preis: "1,80 €", lieferant: "Klöckner", cadLink: "#" },
  { id: 6, name: "Hutmutter", norm: "DIN 1587", material: "Edelstahl A4", kategorie: "Maschinenelemente", groesse: "M10", belastung: "Statisch", preis: "0,35 €", lieferant: "Würth", cadLink: "#" },
  { id: 7, name: "Passscheibe", norm: "DIN 988", material: "Stahl C45", kategorie: "Maschinenelemente", groesse: "20x28x0.5", belastung: "Statisch", preis: "0,08 €", lieferant: "Hahn+Kolb", cadLink: "#" },
  { id: 8, name: "Kabelverschraubung", norm: "EN 50262", material: "Kunststoff PA6", kategorie: "Elektro", groesse: "M20x1.5", belastung: "Statisch", preis: "0,95 €", lieferant: "Lapp", cadLink: "#" },
  { id: 9, name: "Tragschiene", norm: "EN 60715", material: "Stahl verzinkt", kategorie: "Elektro", groesse: "35x7.5mm", belastung: "Statisch", preis: "3,20 €", lieferant: "Phoenix Contact", cadLink: "#" },
  { id: 10, name: "Linearführung", norm: "ISO 12090", material: "Stahl 100Cr6", kategorie: "Maschinenelemente", groesse: "HGH15", belastung: "Dynamisch", preis: "42,00 €", lieferant: "Hiwin", cadLink: "#" },
  { id: 11, name: "Senkblech", norm: "DIN 6796", material: "Stahl DC01", kategorie: "Blech", groesse: "200x100x1.5", belastung: "Statisch", preis: "4,50 €", lieferant: "Klöckner", cadLink: "#" },
  { id: 12, name: "Klemmenblock", norm: "IEC 60947", material: "Kunststoff PA66", kategorie: "Elektro", groesse: "2.5mm²", belastung: "Statisch", preis: "1,10 €", lieferant: "Wago", cadLink: "#" },
];

const kategorien = ["Alle", "Maschinenelemente", "Blech", "Montage", "Elektro"];
const materialien = ["Alle", "Stahl", "Edelstahl", "Aluminium", "Kunststoff", "Grauguss"];
const normen = ["Alle", "DIN", "ISO", "EN", "IEC"];
const belastungen = ["Alle", "Statisch", "Dynamisch"];

export default function Komponenten() {
  const [query, setQuery] = useState("");
  const [kategorie, setKategorie] = useState("Alle");
  const [materialFilter, setMaterialFilter] = useState("Alle");
  const [normFilter, setNormFilter] = useState("Alle");
  const [belastungFilter, setBelastungFilter] = useState("Alle");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const activeFilters = [kategorie, materialFilter, normFilter, belastungFilter].filter(f => f !== "Alle").length;

  const filtered = useMemo(() => {
    return sampleData.filter((k) => {
      const q = query.toLowerCase();
      const matchesQuery = !q || k.name.toLowerCase().includes(q) || k.norm.toLowerCase().includes(q) || k.material.toLowerCase().includes(q);
      const matchesKat = kategorie === "Alle" || k.kategorie === kategorie;
      const matchesMat = materialFilter === "Alle" || k.material.toLowerCase().includes(materialFilter.toLowerCase());
      const matchesNorm = normFilter === "Alle" || k.norm.startsWith(normFilter);
      const matchesBel = belastungFilter === "Alle" || k.belastung === belastungFilter;
      return matchesQuery && matchesKat && matchesMat && matchesNorm && matchesBel;
    });
  }, [query, kategorie, materialFilter, normFilter, belastungFilter]);

  const toggleFav = (id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setQuery("");
    setKategorie("Alle");
    setMaterialFilter("Alle");
    setNormFilter("Alle");
    setBelastungFilter("Alle");
  };

  const exportCSV = () => {
    const rows = filtered.map((k) => [k.name, k.norm, k.material, k.groesse, k.preis, k.lieferant].join(";"));
    const csv = ["Komponente;Norm;Material;Größe;Preis;Lieferant", ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stueckliste.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export erfolgreich", description: `${filtered.length} Komponenten als CSV exportiert.` });
  };

  const favItems = sampleData.filter((k) => favorites.has(k.id));

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Komponenten-Suche</h1>
          <p className="text-muted-foreground mt-1">Normteile, Materialien und Maschinenelemente durchsuchen.</p>
        </div>
        <div className="flex gap-2">
          {favorites.size > 0 && (
            <Badge variant="outline" className="gap-1 py-1.5 px-3">
              <Star className="h-3 w-3 fill-accent text-accent" />
              {favorites.size} Favoriten
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
            <Download className="h-4 w-4" /> CSV Export
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Komponente, Norm oder Material suchen…"
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={kategorie} onValueChange={setKategorie}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Kategorie" /></SelectTrigger>
              <SelectContent>{kategorien.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={materialFilter} onValueChange={setMaterialFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Material" /></SelectTrigger>
              <SelectContent>{materialien.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={normFilter} onValueChange={setNormFilter}>
              <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Norm" /></SelectTrigger>
              <SelectContent>{normen.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={belastungFilter} onValueChange={setBelastungFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Belastung" /></SelectTrigger>
              <SelectContent>{belastungen.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs text-muted-foreground">
                <X className="h-3 w-3" /> Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> Ergebnisse
          </p>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Komponente</TableHead>
                <TableHead>Norm</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Größe</TableHead>
                <TableHead>Preis</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead className="w-20">CAD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Keine Komponenten gefunden. Passen Sie die Filter an.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((k) => (
                  <TableRow key={k.id} className="group">
                    <TableCell>
                      <button onClick={() => toggleFav(k.id)} className="p-1 rounded hover:bg-muted transition-colors">
                        <Star className={`h-4 w-4 ${favorites.has(k.id) ? "fill-accent text-accent" : "text-muted-foreground/40 group-hover:text-muted-foreground"}`} />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-sm">{k.norm}</TableCell>
                    <TableCell className="text-sm">{k.material}</TableCell>
                    <TableCell className="font-mono text-sm">{k.groesse}</TableCell>
                    <TableCell className="font-mono text-sm">{k.preis}</TableCell>
                    <TableCell className="text-sm">{k.lieferant}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">
                        Öffnen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Favorites Summary */}
      {favItems.length > 0 && (
        <Card className="border-accent/30">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 fill-accent text-accent" />
              Stückliste ({favItems.length} Teile)
            </p>
            <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={exportCSV}>
              <Download className="h-3 w-3" /> Exportieren
            </Button>
          </div>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {favItems.map((k) => (
                <Badge key={k.id} variant="secondary" className="gap-1.5 py-1 cursor-pointer" onClick={() => toggleFav(k.id)}>
                  {k.name} <span className="font-mono text-[10px] text-muted-foreground">{k.norm}</span>
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
