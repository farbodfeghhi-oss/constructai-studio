import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layers, Brain, BookOpen, Cog } from "lucide-react";

interface Stat { label: string; value: number; icon: any; color: string; }

export function StatsCounter() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "Projekte / Lösungen", value: 0, icon: Cog, color: "text-blue-300" },
    { label: "Advanced AI Runs", value: 0, icon: Brain, color: "text-amber-300" },
    { label: "Wissensbasis Einträge", value: 0, icon: BookOpen, color: "text-blue-300" },
    { label: "Komponenten DB", value: 0, icon: Layers, color: "text-amber-300" },
  ]);

  useEffect(() => {
    (async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from("solutions").select("id", { count: "exact", head: true }),
        supabase.from("analysis_runs").select("id", { count: "exact", head: true }),
        supabase.from("knowledge_items").select("id", { count: "exact", head: true }),
        supabase.from("components").select("id", { count: "exact", head: true }),
      ]);
      setStats((prev) => [
        { ...prev[0], value: a.count ?? 0 },
        { ...prev[1], value: b.count ?? 0 },
        { ...prev[2], value: c.count ?? 0 },
        { ...prev[3], value: d.count ?? 0 },
      ]);
    })();
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl border border-primary/15 bg-card/60 backdrop-blur p-5 hover:border-accent/40 transition-colors group"
          >
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-accent/20 transition-colors" />
            <Icon className={`h-5 w-5 ${s.color} mb-3`} />
            <div className="font-mono text-3xl font-bold text-foreground tracking-tight">{s.value.toLocaleString("de-DE")}</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}
