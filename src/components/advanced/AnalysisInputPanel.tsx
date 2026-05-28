import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface KnowledgeRef { id: string; title: string; category: string; }
interface UploadedFile { path: string; name: string; size: number; mime: string; }

interface Props {
  onStart: (runId: string) => void;
  disabled?: boolean;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";
const HEIC_RE = /\.(heic|heif)$/i;

export function AnalysisInputPanel({ onStart, disabled }: Props) {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [refs, setRefs] = useState<KnowledgeRef[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("knowledge_items")
        .select("id,title,category")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setRefs((data ?? []) as KnowledgeRef[]);
    })();
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "Nicht eingeloggt", variant: "destructive" }); return; }

    setUploading(true);
    const next: UploadedFile[] = [];
    for (const f of arr) {
      if (HEIC_RE.test(f.name)) {
        toast({ title: "HEIC/HEIF nicht unterstützt", description: f.name, variant: "destructive" });
        continue;
      }
      const path = `${user.id}/${crypto.randomUUID()}/${f.name}`;
      const { error } = await supabase.storage.from("analysis-uploads").upload(path, f, { contentType: f.type });
      if (error) { toast({ title: "Upload-Fehler", description: error.message, variant: "destructive" }); continue; }
      next.push({ path, name: f.name, size: f.size, mime: f.type });
    }
    setFiles((prev) => [...prev, ...next]);
    setUploading(false);
  }, []);

  const removeFile = async (path: string) => {
    await supabase.storage.from("analysis-uploads").remove([path]);
    setFiles((prev) => prev.filter((f) => f.path !== path));
  };

  const toggleRef = (id: string) => {
    setSelectedRefs((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const start = async () => {
    if (prompt.trim().length < 5) {
      toast({ title: "Bitte beschreibe dein Engineering-Anliegen", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("advanced-analysis-start", {
      body: { prompt, reference_ids: Array.from(selectedRefs), file_paths: files.map((f) => f.path) },
    });
    setSubmitting(false);
    if (error || !data?.run_id) {
      toast({ title: "Start fehlgeschlagen", description: error?.message ?? "Unbekannt", variant: "destructive" });
      return;
    }
    onStart(data.run_id);
  };

  const filteredRefs = refs.filter((r) =>
    !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-hidden">
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Engineering-Anfrage</label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Beschreibe Beschreibung, Erwartungen und Ziele. Strukturelle Änderungen, Optimierungen, Entwicklungsschritte…"
          className="min-h-[140px] font-mono text-sm"
          disabled={disabled || submitting}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Multimodale Dateien</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}`}
        >
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">PDF, PNG, JPG, WEBP – Drag & Drop oder klicken</p>
          <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)} />
        </div>
        {uploading && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Lade hoch…</p>}
        {files.length > 0 && (
          <ul className="mt-3 space-y-1">
            {files.map((f) => (
              <li key={f.path} className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded px-2 py-1.5">
                <span className="flex items-center gap-2 truncate">
                  {f.mime.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                  <span className="truncate">{f.name}</span>
                </span>
                <button onClick={() => removeFile(f.path)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Wissensbasis-Referenzen</label>
          <Badge variant="secondary" className="text-[10px]">{selectedRefs.size} aktiv</Badge>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Standards suchen…"
          className="mb-2 h-8 text-xs"
        />
        <ScrollArea className="flex-1 border rounded-md">
          <div className="p-2 space-y-1">
            {filteredRefs.length === 0 && <p className="text-xs text-muted-foreground p-2">Keine Einträge in der Wissensbasis</p>}
            {filteredRefs.map((r) => {
              const active = selectedRefs.has(r.id);
              return (
                <label key={r.id} className={`flex items-start gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${active ? "bg-accent/10" : "hover:bg-muted/50"}`}>
                  <Checkbox checked={active} onCheckedChange={() => toggleRef(r.id)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-muted-foreground text-[10px]">{r.category}</div>
                  </div>
                  {active && <Check className="h-3 w-3 text-accent shrink-0" />}
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <Button
        onClick={start}
        disabled={disabled || submitting || uploading || prompt.trim().length < 5}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
        size="lg"
      >
        {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Initialisiere Pipeline…</> : "Multi-Agent-Analyse starten"}
      </Button>
    </div>
  );
}
