import { useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Upload, Loader2, Languages, Copy, Check, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProviderSelect, type AIProvider } from "@/components/ProviderSelect";
import { RichMediaInput } from "@/components/RichMediaInput";
import { type Attachment } from "@/components/AttachmentPreview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const LANGUAGES = [
  { value: "Deutsch", label: "🇩🇪 Deutsch" },
  { value: "Englisch", label: "🇬🇧 Englisch" },
  { value: "Französisch", label: "🇫🇷 Französisch" },
  { value: "Spanisch", label: "🇪🇸 Spanisch" },
  { value: "Italienisch", label: "🇮🇹 Italienisch" },
  { value: "Persisch", label: "🇮🇷 Persisch" },
  { value: "Arabisch", label: "🇸🇦 Arabisch" },
  { value: "Türkisch", label: "🇹🇷 Türkisch" },
  { value: "Chinesisch", label: "🇨🇳 Chinesisch" },
  { value: "Japanisch", label: "🇯🇵 Japanisch" },
];

export default function PDFTranslate() {
  const [extractedText, setExtractedText] = useState("");
  const [translation, setTranslation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [sourceLang, setSourceLang] = useState("Englisch");
  const [targetLang, setTargetLang] = useState("Deutsch");
  const [provider, setProvider] = useState<AIProvider>("monica");
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ title: "Fehler", description: "Nur PDF-Dateien werden unterstützt.", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Datei zu groß", description: "Maximale Dateigröße: 20 MB", variant: "destructive" });
      return;
    }

    setFileName(file.name);
    setIsExtracting(true);
    setTranslation("");

    try {
      const uint8Array = new Uint8Array(await file.arrayBuffer());
      const text = extractTextFromPDF(uint8Array);
      if (!text.trim()) {
        toast({ title: "Warnung", description: "Kein Text im PDF gefunden. Das PDF könnte gescannt sein.", variant: "destructive" });
      }
      setExtractedText(text);
      toast({ title: "PDF geladen", description: `${file.name} — Text erfolgreich extrahiert.` });
    } catch {
      toast({ title: "Fehler", description: "PDF konnte nicht gelesen werden.", variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const extractTextFromPDF = async (data: Uint8Array): Promise<string> => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
    
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const textParts: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(" ");
      if (pageText.trim()) {
        textParts.push(pageText.trim());
      }
    }
    
    return textParts.join("\n\n");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const translate = async () => {
    if (!extractedText.trim()) {
      toast({ title: "Fehler", description: "Kein Text zum Übersetzen vorhanden.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setTranslation("");
    try {
      const { data, error } = await supabase.functions.invoke("translate-pdf", {
        body: { text: extractedText, sourceLang, targetLang, provider },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTranslation(data.translation);
      toast({ title: "Übersetzung abgeschlossen", description: `${data.chunks || 1} Abschnitt(e) übersetzt.` });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Übersetzung fehlgeschlagen", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyTranslation = async () => {
    await navigator.clipboard.writeText(translation);
    setCopied(true);
    toast({ title: "Kopiert!", description: "Übersetzung in die Zwischenablage kopiert." });
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTranslation = () => {
    const blob = new Blob([translation], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? fileName.replace(".pdf", "_translated.txt") : "translation.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">PDF-Übersetzer</h1>
        <p className="text-muted-foreground mt-1">Technische PDF-Dokumente KI-gestützt übersetzen mit Monica AI oder Perplexity.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">KI:</span>
              <ProviderSelect value={provider} onChange={setProvider} className="w-[160px]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Von:</span>
              <Select value={sourceLang} onValueChange={setSourceLang}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Nach:</span>
              <Select value={targetLang} onValueChange={setTargetLang}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => (<SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <Card
        className="border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => document.getElementById("pdf-input")?.click()}
      >
        <CardContent className="p-8 text-center">
          {isExtracting ? (
            <>
              <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
              <p className="text-muted-foreground">PDF wird gelesen…</p>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">PDF hierher ziehen oder <span className="text-primary font-medium">klicken zum Hochladen</span></p>
              <p className="text-xs text-muted-foreground/60 mt-1">PDF — max. 20 MB</p>
              {fileName && <p className="text-sm font-medium mt-2 text-primary">{fileName}</p>}
            </>
          )}
          <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }} />
        </CardContent>
      </Card>

      {/* Additional attachments */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Zusätzliche Anhänge (Screenshots, Sprachnotizen)</p>
          <RichMediaInput
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            acceptFiles={false}
            acceptImages={true}
            acceptAudio={true}
            acceptScreenshot={true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Quelltext</CardTitle></CardHeader>
        <CardContent>
          {fileName && !extractedText.trim() && (
            <p className="text-sm text-yellow-500 mb-3">⚠️ Kein Text aus dem PDF extrahiert. Das PDF könnte gescannt sein. Sie können den Text manuell einfügen.</p>
          )}
          <Textarea placeholder="Text aus PDF wird hier angezeigt, oder fügen Sie Text manuell ein…" rows={8} value={extractedText} onChange={(e) => setExtractedText(e.target.value)} className="font-mono text-sm" />
          <Button onClick={translate} disabled={isLoading || !extractedText.trim()} className="mt-4 gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {isLoading ? "Übersetze…" : "Übersetzen"}
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="border-primary/20">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="font-medium">KI übersetzt den Text…</p>
            <p className="text-sm text-muted-foreground mt-1">{provider === "monica" ? "Monica AI" : "Perplexity"} arbeitet</p>
          </CardContent>
        </Card>
      )}

      {translation && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Languages className="h-4 w-4 text-primary" /> Übersetzung ({targetLang})</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={copyTranslation}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Kopiert" : "Kopieren"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={downloadTranslation}>
                  <Download className="h-3 w-3" /> Herunterladen
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap font-mono leading-relaxed bg-muted/50 p-4 rounded-md">{translation}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
