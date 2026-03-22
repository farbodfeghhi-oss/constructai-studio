import { useEffect, useState, useRef } from "react";
import { Upload, Search, Layers, BookOpen, PenTool, ClipboardList, ArrowRight, MoreHorizontal, ImagePlus, FileText, Brain, Plus, Link as LinkIcon, Image, FileUp, X, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RichMediaInput } from "@/components/RichMediaInput";
import { type Attachment } from "@/components/AttachmentPreview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const quickActions = [
  { title: "Normteil-Suche", desc: "DIN/ISO Standardteile finden", icon: Search, route: "/komponenten" },
  { title: "Material-Beratung", desc: "Werkstoff-Empfehlungen", icon: Layers, route: "/loesung" },
  { title: "Solid Edge Tipps", desc: "CAD Best-Practices", icon: PenTool, route: "/dokumentation" },
  { title: "DIN/ISO Normen", desc: "Normen nachschlagen", icon: BookOpen, route: "/dokumentation" },
  { title: "Blech-Design", desc: "Sheet Metal Workflow", icon: PenTool, route: "/loesung" },
  { title: "Stückliste erstellen", desc: "BOM generieren", icon: ClipboardList, route: "/dokumentation" },
];

const recentProjects = [
  { name: "Winkelkonsole V2", status: "In Arbeit", date: "18.03.2026", type: "Blechkonstruktion" },
  { name: "Getriebegehäuse", status: "Abgeschlossen", date: "15.03.2026", type: "Maschinenbau" },
  { name: "Montagevorrichtung", status: "Review", date: "12.03.2026", type: "Vorrichtungsbau" },
  { name: "Schaltschrankplatte", status: "In Arbeit", date: "10.03.2026", type: "Schaltschrankbau" },
];

const statusColor: Record<string, string> = {
  "In Arbeit": "bg-engineering-info/15 text-engineering-info border-engineering-info/30",
  "Abgeschlossen": "bg-engineering-success/15 text-engineering-success border-engineering-success/30",
  "Review": "bg-accent/15 text-accent border-accent/30",
};

const CATEGORIES = [
  "Werkstoffe", "Normteile", "Fertigungsverfahren", "Elektro",
  "Montage", "Konstruktion", "Antriebstechnik", "Dichtungstechnik",
  "Verbindungstechnik", "Sonstiges",
];

type KnowledgeItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content_type: string;
  file_url: string | null;
  link_url: string | null;
  ai_summary: string | null;
  keywords: string[];
  created_at: string;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [beschreibung, setBeschreibung] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Wissen state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [addType, setAddType] = useState<"pdf" | "image" | "link">("link");
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addCategory, setAddCategory] = useState("Sonstiges");
  const [addLink, setAddLink] = useState("");
  const [addFile, setAddFile] = useState<File | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const state = location.state as { description?: string; attachments?: Attachment[] } | null;
    if (!state) return;
    setBeschreibung(state.description ?? "");
    setAttachments(state.attachments ?? []);
  }, [location.state]);

  useEffect(() => {
    loadKnowledgeItems();
  }, []);

  const loadKnowledgeItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("knowledge_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setKnowledgeItems(data as unknown as KnowledgeItem[]);
  };

  const analyzeContent = async () => {
    setAnalyzing(true);
    setAiSuggestion(null);
    try {
      let body: any = { provider: "perplexity" };

      if (addType === "link" && addLink) {
        body.contentType = "link";
        body.linkUrl = addLink;
      } else if (addType === "image" && addFile) {
        const base64 = await fileToBase64(addFile);
        body.contentType = "image";
        body.imageBase64 = base64;
      } else if (addType === "pdf" && addFile) {
        const text = await extractPdfText(addFile);
        body.contentType = "pdf";
        body.text = text;
      } else {
        toast({ title: "Bitte Inhalt angeben", variant: "destructive" });
        setAnalyzing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("process-knowledge", { body });
      if (error) throw error;
      setAiSuggestion(data);
      if (data.suggestedTitle && !addTitle) setAddTitle(data.suggestedTitle);
      if (data.suggestedCategory) setAddCategory(data.suggestedCategory);
      toast({ title: "KI-Analyse abgeschlossen" });
    } catch (e: any) {
      toast({ title: "Analyse fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return text;
  };

  const saveKnowledgeItem = async () => {
    if (!addTitle.trim() || !addCategory) {
      toast({ title: "Titel und Kategorie erforderlich", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      let fileUrl: string | null = null;
      if (addFile && (addType === "pdf" || addType === "image")) {
        const ext = addFile.name.split(".").pop();
        const path = `knowledge/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("component-files").upload(path, addFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("component-files").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("knowledge_items").insert({
        user_id: user.id,
        title: addTitle,
        description: addDescription || null,
        category: addCategory,
        content_type: addType,
        file_url: fileUrl,
        link_url: addType === "link" ? addLink : null,
        extracted_text: aiSuggestion?.summary || null,
        ai_summary: aiSuggestion?.summary || null,
        keywords: aiSuggestion?.keywords || [],
      });
      if (error) throw error;

      toast({ title: "Wissen gespeichert!" });
      setShowAddDialog(false);
      resetAddForm();
      loadKnowledgeItems();
    } catch (e: any) {
      toast({ title: "Fehler beim Speichern", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteKnowledgeItem = async (id: string) => {
    const { error } = await supabase.from("knowledge_items").delete().eq("id", id);
    if (!error) {
      setKnowledgeItems((prev) => prev.filter((item) => item.id !== id));
      toast({ title: "Eintrag gelöscht" });
    }
  };

  const resetAddForm = () => {
    setAddTitle("");
    setAddDescription("");
    setAddCategory("Sonstiges");
    setAddLink("");
    setAddFile(null);
    setAiSuggestion(null);
    setAddType("link");
  };

  const weiterZumPassendenBereich = () => {
    const nextState = {
      fromDashboard: true,
      dashboardDraft: { description: beschreibung, attachments },
    };
    navigate(beschreibung.trim() ? "/loesung" : "/analyse", { state: nextState });
  };

  const filteredKnowledge = knowledgeItems.filter(
    (item) =>
      !knowledgeSearch ||
      item.title.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(knowledgeSearch.toLowerCase()) ||
      item.keywords?.some((k) => k.toLowerCase().includes(knowledgeSearch.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero Upload Card */}
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader>
          <CardTitle className="text-2xl">
            Willkommen bei <span className="text-primary">MechAI</span>
          </CardTitle>
          <CardDescription className="text-base">
            Laden Sie ein technisches Bild hoch oder beschreiben Sie Ihr Projekt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background/70 p-5 space-y-4">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Upload className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Projektbeschreibung und Bilder direkt hier vorbereiten</p>
                <p>Mit Beschreibung geht es weiter zu Lösungsvorschlägen, ohne Beschreibung direkt zur Bild-Analyse.</p>
              </div>
            </div>
            <RichMediaInput
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              acceptFiles={false}
              acceptAudio={false}
              acceptScreenshot={true}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {attachments.filter((item) => item.type === "image").length} Bild(er)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                  <FileText className="h-3.5 w-3.5" />
                  Entwurf bleibt beim Zurückgehen erhalten
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Input
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Projektbeschreibung eingeben…"
              className="flex-1"
            />
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={weiterZumPassendenBereich}
              disabled={!beschreibung.trim() && attachments.length === 0}
            >
              {beschreibung.trim() ? "Mit Beschreibung weiter" : "Zur Bild-Analyse"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
              onClick={() => navigate(action.route)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Wissen (Knowledge Base) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Wissen</h2>
            <Badge variant="outline" className="text-xs">{knowledgeItems.length} Einträge</Badge>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" /> Wissen hinzufügen
          </Button>
        </div>

        {knowledgeItems.length > 0 && (
          <div className="mb-3">
            <Input
              placeholder="Wissen durchsuchen…"
              value={knowledgeSearch}
              onChange={(e) => setKnowledgeSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        )}

        {filteredKnowledge.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredKnowledge.slice(0, 9).map((item) => (
              <Card key={item.id} className="group relative">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.content_type === "pdf" && <FileText className="h-4 w-4 text-destructive shrink-0" />}
                      {item.content_type === "image" && <Image className="h-4 w-4 text-primary shrink-0" />}
                      {item.content_type === "link" && <LinkIcon className="h-4 w-4 text-engineering-info shrink-0" />}
                      <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => deleteKnowledgeItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                  {item.ai_summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.ai_summary}</p>
                  )}
                  {item.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.keywords.slice(0, 4).map((kw) => (
                        <Badge key={kw} variant="outline" className="text-[10px] px-1.5 py-0">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Noch kein Wissen gespeichert</p>
              <p className="text-sm mt-1">Fügen Sie PDFs, Bilder oder Links hinzu, damit die KI bessere Lösungen für Ihre Projekte findet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Knowledge Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetAddForm(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Wissen hinzufügen
            </DialogTitle>
            <DialogDescription>
              Laden Sie technische Dokumente, Bilder oder Links hoch. Die KI analysiert den Inhalt automatisch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type Selection */}
            <div className="flex gap-2">
              {([
                { type: "link" as const, icon: LinkIcon, label: "Link" },
                { type: "pdf" as const, icon: FileText, label: "PDF" },
                { type: "image" as const, icon: Image, label: "Bild" },
              ]).map(({ type, icon: Icon, label }) => (
                <Button
                  key={type}
                  variant={addType === type ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setAddType(type); setAddFile(null); setAddLink(""); setAiSuggestion(null); }}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Button>
              ))}
            </div>

            {/* Input based on type */}
            {addType === "link" && (
              <Input
                placeholder="https://www.beispiel.de/produkt"
                value={addLink}
                onChange={(e) => setAddLink(e.target.value)}
              />
            )}

            {(addType === "pdf" || addType === "image") && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={addType === "pdf" ? ".pdf" : "image/*"}
                  className="hidden"
                  onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                />
                <Button variant="outline" className="gap-2 w-full" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="h-4 w-4" />
                  {addFile ? addFile.name : `${addType === "pdf" ? "PDF" : "Bild"} auswählen`}
                </Button>
              </div>
            )}

            {/* AI Analysis Button */}
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={analyzeContent}
              disabled={analyzing || (!addLink && !addFile)}
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {analyzing ? "KI analysiert…" : "Mit KI analysieren"}
            </Button>

            {/* AI Suggestions */}
            {aiSuggestion && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-primary">KI-Vorschläge</p>
                  {aiSuggestion.summary && (
                    <p className="text-xs text-muted-foreground">{aiSuggestion.summary}</p>
                  )}
                  {aiSuggestion.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aiSuggestion.keywords.map((kw: string) => (
                        <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Manual Fields */}
            <Input
              placeholder="Titel"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
            />
            <Textarea
              placeholder="Beschreibung (optional)"
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              rows={2}
            />
            <Select value={addCategory} onValueChange={setAddCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetAddForm(); }}>
              Abbrechen
            </Button>
            <Button onClick={saveKnowledgeItem} disabled={saving || !addTitle.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Aktuelle Projekte</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Letzte Änderung</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((project) => (
                <TableRow key={project.name} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">{project.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[project.status]}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{project.date}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
  const [beschreibung, setBeschreibung] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    const state = location.state as { description?: string; attachments?: Attachment[] } | null;
    if (!state) return;
    setBeschreibung(state.description ?? "");
    setAttachments(state.attachments ?? []);
  }, [location.state]);

  const weiterZumPassendenBereich = () => {
    const nextState = {
      fromDashboard: true,
      dashboardDraft: {
        description: beschreibung,
        attachments,
      },
    };

    navigate(beschreibung.trim() ? "/loesung" : "/analyse", { state: nextState });
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero Upload Card */}
      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <CardHeader>
          <CardTitle className="text-2xl">
            Willkommen bei <span className="text-primary">MechAI</span>
          </CardTitle>
          <CardDescription className="text-base">
            Laden Sie ein technisches Bild hoch oder beschreiben Sie Ihr Projekt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-background/70 p-5 space-y-4">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Upload className="h-5 w-5 mt-0.5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Projektbeschreibung und Bilder direkt hier vorbereiten</p>
                <p>Mit Beschreibung geht es weiter zu Lösungsvorschlägen, ohne Beschreibung direkt zur Bild-Analyse.</p>
              </div>
            </div>

            <RichMediaInput
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              acceptFiles={false}
              acceptAudio={false}
              acceptScreenshot={true}
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                  <ImagePlus className="h-3.5 w-3.5" />
                  {attachments.filter((item) => item.type === "image").length} Bild(er)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                  <FileText className="h-3.5 w-3.5" />
                  Entwurf bleibt beim Zurückgehen erhalten
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Input
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Projektbeschreibung eingeben…"
              className="flex-1"
            />
            <Button
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={weiterZumPassendenBereich}
              disabled={!beschreibung.trim() && attachments.length === 0}
            >
              {beschreibung.trim() ? "Mit Beschreibung weiter" : "Zur Bild-Analyse"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
              onClick={() => navigate(action.route)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Aktuelle Projekte</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Letzte Änderung</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((project) => (
                <TableRow key={project.name} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">{project.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[project.status]}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{project.date}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
