
-- 1. Solutions UPDATE policy
CREATE POLICY "Users can update own solutions"
ON public.solutions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Make component-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'component-files';

-- Drop existing broad SELECT policies on component-files (if any)
DROP POLICY IF EXISTS "Public read access for component-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view component files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read component-files" ON storage.objects;
DROP POLICY IF EXISTS "component-files public read" ON storage.objects;
DROP POLICY IF EXISTS "Component files are publicly accessible" ON storage.objects;

-- Owner-only SELECT (folder-based ownership: <user_id>/...)
CREATE POLICY "Users can view their own component files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'component-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Revoke EXECUTE from public/anon/authenticated on SECURITY DEFINER trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
