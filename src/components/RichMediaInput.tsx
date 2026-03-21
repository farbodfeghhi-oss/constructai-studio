import { useRef, useState, useCallback } from "react";
import { ImagePlus, Paperclip, Mic, MicOff, Camera, MonitorUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentPreview, type Attachment } from "@/components/AttachmentPreview";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";

interface RichMediaInputProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  acceptImages?: boolean;
  acceptFiles?: boolean;
  acceptAudio?: boolean;
  acceptScreenshot?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function RichMediaInput({
  attachments,
  onAttachmentsChange,
  acceptImages = true,
  acceptFiles = true,
  acceptAudio = true,
  acceptScreenshot = true,
  maxFiles = 10,
  maxSizeMB = 10,
}: RichMediaInputProps) {
  const isMobile = useIsMobile();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const addAttachment = useCallback(
    (att: Omit<Attachment, "id">) => {
      if (attachments.length >= maxFiles) {
        toast({ title: "Maximum erreicht", description: `Maximal ${maxFiles} Anhänge erlaubt.`, variant: "destructive" });
        return;
      }
      onAttachmentsChange([...attachments, { ...att, id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }]);
    },
    [attachments, onAttachmentsChange, maxFiles]
  );

  const removeAttachment = useCallback(
    (id: string) => {
      onAttachmentsChange(attachments.filter((a) => a.id !== id));
    },
    [attachments, onAttachmentsChange]
  );

  const handleFiles = useCallback(
    (files: FileList | null, type: "image" | "file") => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast({ title: "Datei zu groß", description: `Max. ${maxSizeMB} MB: ${file.name}`, variant: "destructive" });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          addAttachment({
            type,
            name: file.name,
            dataUrl: e.target?.result as string,
            mimeType: file.type,
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
      });
    },
    [addAttachment, maxSizeMB]
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = (e) => {
          addAttachment({
            type: "audio",
            name: `Aufnahme_${new Date().toLocaleTimeString("de-DE")}.${mimeType.split("/")[1]}`,
            dataUrl: e.target?.result as string,
            mimeType,
            size: blob.size,
          });
        };
        reader.readAsDataURL(blob);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast({ title: "Mikrofon-Zugriff verweigert", description: "Bitte erlauben Sie den Mikrofon-Zugriff.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const captureScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const canvas = document.createElement("canvas");

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);

      track.stop();
      stream.getTracks().forEach((t) => t.stop());

      const dataUrl = canvas.toDataURL("image/png");
      addAttachment({
        type: "image",
        name: `Screenshot_${new Date().toLocaleTimeString("de-DE")}.png`,
        dataUrl,
        mimeType: "image/png",
        size: Math.round(dataUrl.length * 0.75),
      });
    } catch {
      toast({ title: "Screenshot abgebrochen", variant: "destructive" });
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-2">
      {/* Attachment bar */}
      <div className="flex items-center gap-1 flex-wrap">
        {acceptImages && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" /> Bilder
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files, "image");
                e.target.value = "";
              }}
            />
          </>
        )}

        {acceptFiles && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" /> Dateien
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.dxf,.step,.stp,.iges,.igs,.csv,.xlsx,.doc,.docx"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files, "file");
                e.target.value = "";
              }}
            />
          </>
        )}

        {acceptAudio && (
          <Button
            type="button"
            variant={isRecording ? "destructive" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <>
                <MicOff className="h-4 w-4" /> Stopp ({formatTime(recordingTime)})
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Aufnahme
              </>
            )}
          </Button>
        )}

        {acceptScreenshot && !isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={captureScreenshot}
          >
            <MonitorUp className="h-4 w-4" /> Screenshot
          </Button>
        )}

        {acceptScreenshot && isMobile && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" /> Kamera
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files, "image");
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {/* Preview grid */}
      <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />
    </div>
  );
}
