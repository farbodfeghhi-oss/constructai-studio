import { X, FileText, Mic, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Attachment {
  id: string;
  type: "image" | "file" | "audio";
  name: string;
  dataUrl: string;
  mimeType: string;
  size: number;
}

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="relative group flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2 pr-8 max-w-[200px]"
        >
          {att.type === "image" ? (
            <img
              src={att.dataUrl}
              alt={att.name}
              className="h-10 w-10 rounded object-cover shrink-0"
            />
          ) : att.type === "audio" ? (
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <Mic className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{att.name}</p>
            <p className="text-[10px] text-muted-foreground">{formatSize(att.size)}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(att.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
