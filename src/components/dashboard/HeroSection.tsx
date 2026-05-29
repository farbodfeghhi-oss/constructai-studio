import { Sparkles, Cpu, Activity, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  heroUrl?: string;
  generating: boolean;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
  onRegenerateAll?: () => void;
}

export function HeroSection({ heroUrl, generating, isRegenerating, onRegenerate, onRegenerateAll }: Props) {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[#0a0e27] group">
      <div className="absolute inset-0">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt="MechAI Engineering Blueprint"
            className="w-full h-full object-cover opacity-50 animate-fade-in"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0a0e27] via-[#1e3a8a] to-[#0a0e27] animate-pulse" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e27] via-[#0a0e27]/70 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.15) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {isRegenerating && (
          <div className="absolute inset-0 bg-[#0a0e27]/70 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 border border-accent/40 text-accent text-sm font-mono">
              <Loader2 className="h-4 w-4 animate-spin" /> Hero wird neu gerendert…
            </div>
          </div>
        )}
      </div>

      {/* Regeneration controls */}
      <div className="absolute top-3 right-3 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onRegenerate && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-7 px-2 text-[10px] bg-black/40 backdrop-blur border-white/20 text-white hover:bg-black/60"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isRegenerating ? "animate-spin" : ""}`} /> Hero neu
          </Button>
        )}
        {onRegenerateAll && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerateAll}
            disabled={isRegenerating || generating}
            className="h-7 px-2 text-[10px] bg-black/40 backdrop-blur border-white/20 text-white hover:bg-black/60"
            title="Alle Visuals neu generieren"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${generating ? "animate-spin" : ""}`} /> Alle neu
          </Button>
        )}
      </div>

      <div className="relative px-8 py-16 md:px-14 md:py-24 max-w-5xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/40 bg-accent/10 text-accent text-xs font-mono uppercase tracking-widest mb-6 animate-fade-in">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Engineering Intelligence · Online
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4 animate-fade-in">
          MechAI · <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-amber-400 bg-clip-text text-transparent">Engineering Intelligence Platform</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300/90 max-w-2xl mb-8 leading-relaxed animate-fade-in">
          Multi-Agent AI für Mechanik-Design, Normenprüfung, Lösungsgenerierung und technische Dokumentation – speziell für Maschinenbau & Solid Edge Workflows.
        </p>
        <div className="flex flex-wrap gap-3 animate-fade-in">
          <Button
            size="lg"
            onClick={() => navigate("/advanced-engineering-analysis")}
            className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 shadow-lg shadow-accent/20"
          >
            <Sparkles className="h-4 w-4" />
            Advanced Analysis starten
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/loesung")}
            className="border-blue-400/40 bg-blue-400/5 text-blue-200 hover:bg-blue-400/10 gap-2"
          >
            <Cpu className="h-4 w-4" />
            Lösungs-Generator
          </Button>
          {generating && (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-400/30 bg-blue-400/5 text-blue-300 text-xs font-mono">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              Generiere Dashboard-Visuals…
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
