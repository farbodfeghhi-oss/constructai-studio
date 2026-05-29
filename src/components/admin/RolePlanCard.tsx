import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Edit3, Loader2, Save, X, Search, Brain, Image as ImageIcon, Zap, Database, FileJson, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface RolePlan {
  id: string;
  key: string;
  name: string;
  description: string;
  provider_mode: string;
  models: Record<string, any>;
  system_prompt: string;
  is_active: boolean;
  api_mode?: string;
  endpoint?: string | null;
  search_domain_filter?: string[];
  search_mode?: string | null;
  response_format?: any;
  tools?: any[];
  max_steps?: number | null;
  supports_multimodal?: boolean;
}

export function RolePlanCard({ plan, password, onChanged }: { plan: RolePlan; password: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(plan.system_prompt);
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("update-active-role", { body: { password, plan_id: plan.id } });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({ title: "Aktivierung fehlgeschlagen", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: `Rolle aktiv: ${plan.name}` });
    onChanged();
  };

  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("update-role-prompt", { body: { password, plan_id: plan.id, system_prompt: prompt } });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({ title: "Speichern fehlgeschlagen", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Prompt gespeichert" });
    setEditing(false);
    onChanged();
  };

  const providers = plan.provider_mode.split(/[+\-]/).filter((x) => x === "perplexity" || x === "monica");

  return (
    <div className={`relative rounded-xl border p-5 bg-card/60 backdrop-blur transition-all ${plan.is_active ? "border-accent shadow-lg shadow-accent/10" : "border-primary/15 hover:border-primary/40"}`}>
      {plan.is_active && (
        <div className="absolute -top-3 left-5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-widest">
          <CheckCircle2 className="h-3 w-3" /> Aktiv
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
          <code className="text-[10px] font-mono text-muted-foreground">{plan.key}</code>
        </div>
        <div className="flex gap-1">
          {providers.includes("perplexity") && (
            <Badge variant="outline" className="border-blue-400/40 text-blue-300 text-[10px] gap-1"><Search className="h-2.5 w-2.5" />Perplexity</Badge>
          )}
          {providers.includes("monica") && (
            <Badge variant="outline" className="border-amber-400/40 text-amber-300 text-[10px] gap-1"><Brain className="h-2.5 w-2.5" />Monica</Badge>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{plan.description}</p>

      {editing ? (
        <div className="space-y-2">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Speichern
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setPrompt(plan.system_prompt); }} className="gap-1">
              <X className="h-3 w-3" /> Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-muted/30 border border-border/40 p-3 max-h-28 overflow-hidden relative">
          <p className="text-[11px] font-mono text-muted-foreground leading-relaxed line-clamp-4">{plan.system_prompt}</p>
        </div>
      )}

      {!editing && (
        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1 text-xs">
            <Edit3 className="h-3 w-3" /> Prompt bearbeiten
          </Button>
          {!plan.is_active && (
            <Button size="sm" onClick={activate} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1 text-xs ml-auto">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Aktivieren
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
