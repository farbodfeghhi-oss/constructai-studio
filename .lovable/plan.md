

## Plan: Rich Media Input Component for All AI Pages

### Current State
The app has 4 pages with AI input: **Analyse** (single image upload), **Loesung** (text only), **Prompts** (text only), **PDFTranslate** (PDF upload). None support multi-image, voice recording, or screenshot capture.

### What Will Be Built

A reusable `<RichMediaInput>` component with the following capabilities:

1. **Multi-Image Upload** -- Drag-and-drop or file picker for multiple images simultaneously (JPG, PNG, WebP)
2. **File Upload** -- Support for PDF, DXF, STEP, CSV and other engineering file formats
3. **Voice Recording** -- In-browser microphone recording using the MediaRecorder API, with a record/stop button and audio preview
4. **Screenshot/Camera Capture** -- Uses `navigator.mediaDevices.getDisplayMedia()` on desktop for screen capture, and camera input (`capture="environment"`) on mobile for taking photos directly

### Architecture

**New Components:**
- `src/components/RichMediaInput.tsx` -- Main reusable component with attachment bar (icons for: images, files, microphone, screenshot/camera)
- `src/components/AttachmentPreview.tsx` -- Thumbnail grid showing attached images, files, and audio clips with remove buttons

**Attachment Data Model:**
```text
type Attachment = {
  id: string
  type: 'image' | 'file' | 'audio'
  name: string
  dataUrl: string      // base64 data URL
  mimeType: string
  size: number
}
```

**Page Integration:**
- **Analyse.tsx** -- Replace single-image upload with RichMediaInput (multi-image support). All images sent to `analyze-image` edge function.
- **Loesung.tsx** -- Add RichMediaInput below the textarea. Attached images/files are included as context in the `generate-solutions` request.
- **Prompts.tsx** -- Add RichMediaInput below the textarea. Reference images can guide prompt generation.
- **PDFTranslate.tsx** -- Extend existing upload zone with RichMediaInput to also accept voice memos and screenshots alongside PDFs.

### Technical Details

**Voice Recording:**
- Uses `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder` API
- Records as `audio/webm` (or `audio/mp4` fallback)
- Shows recording indicator with duration timer
- Resulting audio blob converted to base64 for attachment

**Screenshot Capture:**
- Desktop: `navigator.mediaDevices.getDisplayMedia({ video: true })` captures a frame, draws to canvas, exports as PNG
- Mobile: Falls back to `<input type="file" accept="image/*" capture="environment">` for camera capture
- Uses `useIsMobile()` hook to determine which method to use

**Edge Function Updates:**
- `analyze-image`: Accept `images[]` array instead of single `image` field, process multiple images
- `generate-solutions`: Accept optional `attachments[]` with base64 data for context
- `generate-prompt`: Accept optional reference images

**No database changes required** -- all attachments are processed in-memory and sent directly to edge functions.

### Files to Create/Modify

| Action | File |
|--------|------|
| Create | `src/components/RichMediaInput.tsx` |
| Create | `src/components/AttachmentPreview.tsx` |
| Modify | `src/pages/Analyse.tsx` |
| Modify | `src/pages/Loesung.tsx` |
| Modify | `src/pages/Prompts.tsx` |
| Modify | `src/pages/PDFTranslate.tsx` |
| Modify | `supabase/functions/analyze-image/index.ts` |
| Modify | `supabase/functions/generate-solutions/index.ts` |
| Modify | `supabase/functions/generate-prompt/index.ts` |

