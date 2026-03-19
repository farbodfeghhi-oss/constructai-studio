import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Komponenten() {
  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold">Komponenten-Suche</h1>
      <p className="text-muted-foreground">Normteile, Materialien und Maschinenelemente durchsuchen.</p>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Komponente suchen…" className="pl-10" />
      </div>
    </div>
  );
}
