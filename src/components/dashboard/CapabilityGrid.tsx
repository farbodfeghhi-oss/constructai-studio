import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Cog, Sparkles, BookOpen, Layers, FileText, Shield, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Cap { key: string; title: string; sub: string; route: string; icon: any; }

const CAPS: Cap[] = [
  { key: "cap_loesung", title: "Lösungs-Generator", sub: "3 KI-Varianten: Best / Budget / Performance", route: "/loesung", icon: Cog },
  { key: "cap_analysis", title: "Advanced Engineering Analysis", sub: "Multi-Agent Pipeline mit Live-Status", route: "/advanced-engineering-analysis", icon: Sparkles },
  { key: "cap_knowledge", title: "Wissensbasis", sub: "PDFs, Normen, technische Bücher (RAG)", route: "/dokumentation", icon: BookOpen },
  { key: "cap_components", title: "Komponenten-DB", sub: "Normteile, Materialien, Lieferanten", route: "/dokumentation", icon: Layers },
  { key: "cap_docs", title: "Doku & Export", sub: "Technische Zeichnungen, BOM, PDF", route: "/loesung", icon: FileText },
  { key: "cap_roles", title: "AI Rollen-Manager", sub: "Backend-Persona umschalten (geschützt)", route: "/ai-roles", icon: Shield },
];

interface Props {
  assets: Record<string, string>;
  regeneratingKeys?: Set<string>;
  onRegenerateKey?: (key: string) => void;
}

export function CapabilityGrid({ assets, regeneratingKeys, onRegenerateKey }: Props) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Plattform-Fähigkeiten</h2>
          <p className="text-sm text-muted-foreground mt-1">Sechs KI-gestützte Werkzeuge für den professionellen Konstruktionsalltag.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CAPS.map((c) => {
          const Icon = c.icon;
          const img = assets[c.key];
          const isRegen = regeneratingKeys?.has(c.key) ?? false;
          return (
            <div
              key={c.key}
              className="group relative text-left overflow-hidden rounded-xl border border-primary/15 bg-card/50 backdrop-blur hover:border-accent/50 hover:bg-card/80 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10 animate-fade-in"
            >
              <button onClick={() => navigate(c.route)} className="block w-full text-left">
                <div className="relative h-44 bg-gradient-to-br from-[#0a0e27] via-[#1e3a8a]/40 to-[#0a0e27] overflow-hidden">
                  {img ? (
                    <img src={img} alt={c.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className="h-16 w-16 text-blue-400/30 animate-pulse" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                  <div className="absolute top-3 left-3 h-9 w-9 rounded-md bg-accent/90 text-accent-foreground flex items-center justify-center shadow-lg">
                    <Icon className="h-4 w-4" />
                  </div>
                  {isRegen && (
                    <div className="absolute inset-0 bg-[#0a0e27]/75 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/20 border border-accent/40 text-accent text-xs font-mono">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Rendere…
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors">{c.title}</h3>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.sub}</p>
                </div>
              </button>
              {onRegenerateKey && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); onRegenerateKey(c.key); }}
                  disabled={isRegen}
                  className="absolute top-3 right-3 h-7 px-2 text-[10px] bg-black/40 backdrop-blur border-white/20 text-white hover:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isRegen ? "animate-spin" : ""}`} /> Neu
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
