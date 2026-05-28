import { Sparkles, Cpu, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  heroUrl?: string;
  generating: boolean;
}

export function HeroSection({ heroUrl, generating }: Props) {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-[#0a0e27]">
      {/* Background image */}
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
        {/* Overlays */}
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
