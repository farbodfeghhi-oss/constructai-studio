import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Edit3, Loader2, Save, X, Search, Image as ImageIcon, Zap, Database, FileJson, Globe } from "lucide-react";
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
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  const [prompt, setPrompt] = useState(plan.system_prompt);
  const [modelsText, setModelsText] = useState(JSON.stringify(plan.models ?? {}, null, 2));
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName(plan.name);
    setDescription(plan.description);
    setPrompt(plan.system_prompt);
    setModelsText(JSON.stringify(plan.models ?? {}, null, 2));
  };

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
    let models: Record<string, unknown>;
    try {
      models = JSON.parse(modelsText);
      if (!models || typeof models !== "object" || Array.isArray(models)) throw new Error("Muss ein JSON-Objekt sein");
    } catch (e) {
      toast({ title: "Models JSON ungültig", description: e instanceof Error ? e.message : "Parse-Fehler", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("update-role-plan", {
      body: { password, plan_id: plan.id, name, description, system_prompt: prompt, models },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({ title: "Speichern fehlgeschlagen", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Plan gespeichert" });
    setEditing(false);
    onChanged();
  };

  return (
    <div className={`relative rounded-xl border p-5 bg-card/60 backdrop-blur transition-all ${plan.is_active ? "border-accent shadow-lg shadow-accent/10" : "border-primary/15 hover:border-primary/40"}`}>
      {plan.is_active && (
        <div className="absolute -top-3 left-5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-widest">
          <CheckCircle2 className="h-3 w-3" /> Aktiv
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="text-base font-bold h-8 mb-1" />
          ) : (
            <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
          )}
          <code className="text-[10px] font-mono text-muted-foreground">{plan.key}</code>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Badge variant="outline" className="border-blue-400/40 text-blue-300 text-[10px] gap-1"><Search className="h-2.5 w-2.5" />Perplexity</Badge>
        </div>
      </div>

      {editing ? (
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className="text-xs mb-3" placeholder="Beschreibung" />
      ) : (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{plan.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {plan.api_mode && (
          <Badge variant="outline" className="border-primary/30 text-[10px] gap-1 font-mono"><Zap className="h-2.5 w-2.5" />{plan.api_mode}</Badge>
        )}
        {plan.endpoint && (
          <Badge variant="outline" className="border-muted text-[10px] gap-1 font-mono text-muted-foreground">{plan.endpoint}</Badge>
        )}
        {plan.supports_multimodal && (
          <Badge variant="outline" className="border-purple-400/40 text-purple-300 text-[10px] gap-1"><ImageIcon className="h-2.5 w-2.5" />multimodal</Badge>
        )}
        {plan.search_mode && (
          <Badge variant="outline" className="border-emerald-400/40 text-emerald-300 text-[10px] gap-1"><Globe className="h-2.5 w-2.5" />{plan.search_mode}</Badge>
        )}
        {plan.response_format && (
          <Badge variant="outline" className="border-cyan-400/40 text-cyan-300 text-[10px] gap-1"><FileJson className="h-2.5 w-2.5" />json_schema</Badge>
        )}
        {plan.max_steps != null && (
          <Badge variant="outline" className="text-[10px] font-mono">max_steps: {plan.max_steps}</Badge>
        )}
        {(plan.tools?.length ?? 0) > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1"><Database className="h-2.5 w-2.5" />{plan.tools!.map((t: any) => t.type || t).join(", ")}</Badge>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Models (JSON)</Label>
            <Textarea
              value={modelsText}
              onChange={(e) => setModelsText(e.target.value)}
              rows={6}
              className="font-mono text-[11px] mt-1"
              placeholder={`{\n  "primary": "sonar-pro",\n  "fallback": ["sonar"]\n}`}
            />
            <p className="text-[10px] text-muted-foreground mt-1">JSON-Objekt mit Keys wie <code className="font-mono">primary</code>, <code className="font-mono">fallback</code>, <code className="font-mono">vision</code>.</p>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">System Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} className="font-mono text-xs mt-1" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={busy} className="gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Speichern
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); reset(); }} className="gap-1">
              <X className="h-3 w-3" /> Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <>
          {plan.models && Object.keys(plan.models).length > 0 && (
            <div className="mb-3 rounded-md bg-muted/20 border border-border/30 p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-mono">Models</div>
              <div className="space-y-0.5">
                {Object.entries(plan.models).map(([k, v]) => (
                  <div key={k} className="text-[10px] font-mono flex gap-2">
                    <span className="text-muted-foreground min-w-[70px]">{k}:</span>
                    <span className="text-foreground/90">{Array.isArray(v) ? v.join(" → ") : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(plan.search_domain_filter?.length ?? 0) > 0 && (
            <div className="mb-3 rounded-md bg-muted/20 border border-border/30 p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-mono">Domain Filter</div>
              <div className="flex flex-wrap gap-1">
                {plan.search_domain_filter!.map((d) => (
                  <code key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/40 text-foreground/80">{d}</code>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted/30 border border-border/40 p-3 max-h-28 overflow-hidden relative">
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed line-clamp-4">{plan.system_prompt}</p>
          </div>

          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => { reset(); setEditing(true); }} className="gap-1 text-xs">
              <Edit3 className="h-3 w-3" /> Plan bearbeiten
            </Button>
            {!plan.is_active && (
              <Button size="sm" onClick={activate} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1 text-xs ml-auto">
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Aktivieren
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
