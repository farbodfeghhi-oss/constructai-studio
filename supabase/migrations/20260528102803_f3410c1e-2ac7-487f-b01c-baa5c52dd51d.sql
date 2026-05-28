
-- 1. Erweiterungen knowledge_items
ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'technical',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE public.knowledge_items
  DROP CONSTRAINT IF EXISTS knowledge_items_scope_check;
ALTER TABLE public.knowledge_items
  ADD CONSTRAINT knowledge_items_scope_check CHECK (scope IN ('norm','technical'));

DROP TRIGGER IF EXISTS update_knowledge_items_updated_at ON public.knowledge_items;
CREATE TRIGGER update_knowledge_items_updated_at
BEFORE UPDATE ON public.knowledge_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS knowledge_items_user_scope_idx
  ON public.knowledge_items (user_id, scope);

-- 2. Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-files', 'knowledge-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "knowledge_files_select_own" ON storage.objects;
DROP POLICY IF EXISTS "knowledge_files_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "knowledge_files_update_own" ON storage.objects;
DROP POLICY IF EXISTS "knowledge_files_delete_own" ON storage.objects;

CREATE POLICY "knowledge_files_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "knowledge_files_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "knowledge_files_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "knowledge_files_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'knowledge-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Demo-Daten aus components entfernen
DELETE FROM public.components;
