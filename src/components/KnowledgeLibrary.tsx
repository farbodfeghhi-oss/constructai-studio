import { useState, useEffect, useCallback, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Upload, Search, Trash2, Loader2, FileText, Image as ImageIcon,
  Link2, Type, Sparkles, X, HardDrive, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export type KnowledgeScope = "norm" | "technical";

interface KnowledgeItem {
  id: string;
  title: string;
  source_name: string | null;
  domain: string | null;
  category: string;
  content_type: string;
  ai_summary: string | null;
  keywords: string[] | null;
  is_active: boolean;
  file_url: string | null;
  link_url: string | null;
  created_at: string;
}

interface KnowledgeLibraryProps {
  scope: KnowledgeScope;
  uploadLabel: string;
  searchPlaceholder: string;
  emptyHint: string;
}

const BUCKET = "knowledge-files";

async function extractPdfText(file: File, onProgress: (pct: number) => void): Promise<string> {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const buf = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it: any) => it.str).join(" "));
    onProgress(Math.round((i / pdf.numPages) * 100));
  }
  return parts.join("\n\n");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function KnowledgeLibrary({ scope, uploadLabel, searchPlaceholder, emptyHint }: KnowledgeLibraryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"pdf" | "image" | "url" | "text" | "drive">("pdf");
  const [linkUrl, setLinkUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [driveQuery, setDriveQuery] = useState("");
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string; modifiedTime?: string }>>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveLoaded, setDriveLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_items")
      .select("id,title,source_name,domain,category,content_type,ai_summary,keywords,is_active,file_url,link_url,created_at")
      .eq("scope", scope)
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as KnowledgeItem[]);
    setLoading(false);
  }, [user, scope]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      it.title?.toLowerCase().includes(q) ||
      it.source_name?.toLowerCase().includes(q) ||
      it.domain?.toLowerCase().includes(q) ||
      it.category?.toLowerCase().includes(q) ||
      it.ai_summary?.toLowerCase().includes(q) ||
      it.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  async function analyzeAndSave(opts: {
    contentType: "pdf" | "image" | "url" | "text";
    text?: string;
    imageBase64?: string;
    linkUrl?: string;
    fileUrl?: string | null;
    fallbackTitle: string;
  }) {
    setProgressLabel("KI analysiert Inhalt…");
    setProgress(85);

    const { data, error } = await supabase.functions.invoke("process-knowledge-source", {
      body: {
        contentType: opts.contentType,
        text: opts.text,
        imageBase64: opts.imageBase64,
        linkUrl: opts.linkUrl,
      },
    });
    if (error) throw new Error(error.message || "KI-Analyse fehlgeschlagen");

    const meta = data?.metadata ?? {};
    setProgressLabel("Speichern…");
    setProgress(95);

    const insert = {
      user_id: user!.id,
      scope,
      title: meta.source_name || opts.fallbackTitle,
      source_name: meta.source_name || opts.fallbackTitle,
      domain: meta.domain || null,
      category: meta.domain || (scope === "norm" ? "Norm" : "Technisch"),
      content_type: opts.contentType,
      ai_summary: meta.summary || null,
      keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
      extracted_text: opts.text || null,
      file_url: opts.fileUrl || null,
      link_url: opts.linkUrl || null,
      is_active: true,
    };

    const { error: insErr } = await supabase.from("knowledge_items").insert(insert);
    if (insErr) throw insErr;

    setProgress(100);
    toast({ title: "Gespeichert", description: insert.title });
  }

  async function handlePdf(file: File) {
    if (!user) return;
    setProcessing(true);
    try {
      setProgressLabel("Upload läuft…");
      setProgress(5);
      const path = `${user.id}/${scope}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      setProgress(35);

      setProgressLabel("Text aus PDF extrahieren…");
      const text = await extractPdfText(file, (pct) => setProgress(35 + Math.round(pct * 0.45)));
      if (!text.trim()) throw new Error("Im PDF wurde kein extrahierbarer Text gefunden.");

      await analyzeAndSave({
        contentType: "pdf",
        text,
        fileUrl: path,
        fallbackTitle: file.name.replace(/\.pdf$/i, ""),
      });
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message || "Verarbeitung fehlgeschlagen", variant: "destructive" });
    } finally {
      setTimeout(() => { setProcessing(false); setProgress(0); setProgressLabel(""); }, 600);
    }
  }

  async function handleImage(file: File) {
    if (!user) return;
    if (/heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name)) {
      toast({ title: "Format nicht unterstützt", description: "Bitte JPG, PNG oder WEBP verwenden.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      setProgressLabel("Upload läuft…");
      setProgress(10);
      const path = `${user.id}/${scope}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      setProgress(50);

      setProgressLabel("Bild lesen…");
      const dataUrl = await fileToDataUrl(file);
      setProgress(70);

      await analyzeAndSave({
        contentType: "image",
        imageBase64: dataUrl,
        fileUrl: path,
        fallbackTitle: file.name.replace(/\.[^.]+$/, ""),
      });
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message || "Verarbeitung fehlgeschlagen", variant: "destructive" });
    } finally {
      setTimeout(() => { setProcessing(false); setProgress(0); setProgressLabel(""); }, 600);
    }
  }

  async function handleUrl() {
    if (!linkUrl.trim()) return;
    setProcessing(true);
    try {
      setProgressLabel("URL wird analysiert…");
      setProgress(40);
      await analyzeAndSave({
        contentType: "url",
        linkUrl: linkUrl.trim(),
        fallbackTitle: linkUrl.trim(),
      });
      setLinkUrl("");
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message || "Verarbeitung fehlgeschlagen", variant: "destructive" });
    } finally {
      setTimeout(() => { setProcessing(false); setProgress(0); setProgressLabel(""); }, 600);
    }
  }

  async function handleText() {
    if (!rawText.trim()) return;
    setProcessing(true);
    try {
      setProgressLabel("Text wird analysiert…");
      setProgress(50);
      await analyzeAndSave({
        contentType: "text",
        text: rawText.trim(),
        fallbackTitle: textTitle.trim() || rawText.slice(0, 60),
      });
      setRawText("");
      setTextTitle("");
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message || "Verarbeitung fehlgeschlagen", variant: "destructive" });
    } finally {
      setTimeout(() => { setProcessing(false); setProgress(0); setProgressLabel(""); }, 600);
    }
  }

  async function loadDriveFiles() {
    setDriveLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gdrive-browse", {
        body: { action: "list", query: driveQuery.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setDriveFiles(data?.files ?? []);
      setDriveLoaded(true);
    } catch (e: any) {
      toast({ title: "Google Drive Fehler", description: e.message || "Konnte Dateien nicht laden", variant: "destructive" });
    } finally {
      setDriveLoading(false);
    }
  }

  function base64ToFile(base64: string, name: string, mimeType: string): File {
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mimeType });
  }

  async function importFromDrive(file: { id: string; name: string; mimeType: string }) {
    if (!user || processing) return;
    setProcessing(true);
    try {
      setProgressLabel(`Lade „${file.name}" von Google Drive…`);
      setProgress(15);
      const { data, error } = await supabase.functions.invoke("gdrive-browse", {
        body: { action: "download", fileId: file.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const realFile = base64ToFile(data.base64, data.name, data.mimeType);
      setProcessing(false);
      setProgress(0);
      setProgressLabel("");

      if (data.mimeType === "application/pdf") {
        await handlePdf(realFile);
      } else if (data.mimeType?.startsWith("image/")) {
        await handleImage(realFile);
      } else {
        throw new Error(`Dateityp ${data.mimeType} wird nicht unterstützt`);
      }
    } catch (e: any) {
      toast({ title: "Drive-Import fehlgeschlagen", description: e.message, variant: "destructive" });
      setProcessing(false);
      setProgress(0);
      setProgressLabel("");
    }
  }

  async function toggleActive(item: KnowledgeItem, next: boolean) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: next } : i)));
    const { error } = await supabase.from("knowledge_items").update({ is_active: next }).eq("id", item.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: !next } : i)));
    }
  }

  async function remove(item: KnowledgeItem) {
    if (!confirm(`„${item.title}" löschen?`)) return;
    const { error } = await supabase.from("knowledge_items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    if (item.file_url) {
      await supabase.storage.from(BUCKET).remove([item.file_url]);
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast({ title: "Gelöscht" });
  }

  const ContentIcon = ({ type }: { type: string }) => {
    if (type === "pdf") return <FileText className="h-4 w-4 text-primary" />;
    if (type === "image") return <ImageIcon className="h-4 w-4 text-primary" />;
    if (type === "url") return <Link2 className="h-4 w-4 text-primary" />;
    return <Type className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="space-y-4">
      {/* Upload */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">{uploadLabel}</h3>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="pdf" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" />PDF</TabsTrigger>
              <TabsTrigger value="image" className="text-xs gap-1.5"><ImageIcon className="h-3.5 w-3.5" />Bild</TabsTrigger>
              <TabsTrigger value="url" className="text-xs gap-1.5"><Link2 className="h-3.5 w-3.5" />URL</TabsTrigger>
              <TabsTrigger value="text" className="text-xs gap-1.5"><Type className="h-3.5 w-3.5" />Text</TabsTrigger>
              <TabsTrigger value="drive" className="text-xs gap-1.5"><HardDrive className="h-3.5 w-3.5" />Drive</TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePdf(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                className="w-full gap-2"
                disabled={processing}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> PDF auswählen (keine Größenbeschränkung)
              </Button>
            </TabsContent>

            <TabsContent value="image" className="mt-3">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImage(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                className="w-full gap-2"
                disabled={processing}
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" /> Bild auswählen (PNG / JPG / WEBP)
              </Button>
            </TabsContent>

            <TabsContent value="url" className="mt-3 space-y-2">
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                disabled={processing}
              />
              <Button className="w-full gap-2" disabled={processing || !linkUrl.trim()} onClick={handleUrl}>
                <Sparkles className="h-4 w-4" /> URL analysieren & speichern
              </Button>
            </TabsContent>

            <TabsContent value="text" className="mt-3 space-y-2">
              <Input
                placeholder="Titel (optional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                disabled={processing}
              />
              <Textarea
                placeholder="Text eingeben…"
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                disabled={processing}
              />
              <Button className="w-full gap-2" disabled={processing || !rawText.trim()} onClick={handleText}>
                <Sparkles className="h-4 w-4" /> Text analysieren & speichern
              </Button>
            </TabsContent>
          </Tabs>

          {processing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> {progressLabel}
                </span>
                <span className="font-mono">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {search ? "Keine Treffer." : emptyHint}
            </CardContent>
          </Card>
        )}
        {filtered.map((item) => (
          <Card key={item.id} className={item.is_active ? "" : "opacity-60"}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1"><ContentIcon type={item.content_type} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm truncate">{item.source_name || item.title}</h4>
                    {item.domain && <Badge variant="secondary" className="text-[10px]">{item.domain}</Badge>}
                    <Badge variant="outline" className="text-[10px] uppercase">{item.content_type}</Badge>
                  </div>
                  {item.ai_summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.ai_summary}</p>
                  )}
                  {item.keywords && item.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.keywords.slice(0, 6).map((k, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{k}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{item.is_active ? "Aktiv" : "Inaktiv"}</span>
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={(v) => toggleActive(item, v)}
                      aria-label="Für neue Lösungen aktivieren"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => remove(item)}
                    aria-label="Eintrag löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
