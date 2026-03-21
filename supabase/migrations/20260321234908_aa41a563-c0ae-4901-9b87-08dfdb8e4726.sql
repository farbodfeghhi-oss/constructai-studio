
-- Components table
CREATE TABLE public.components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  keywords text[] DEFAULT '{}',
  norm text,
  material text,
  supplier text,
  price text,
  size text,
  url text,
  image_urls text[] DEFAULT '{}',
  file_urls text[] DEFAULT '{}',
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own components" ON public.components
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own components" ON public.components
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own components" ON public.components
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own components" ON public.components
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_components_updated_at
  BEFORE UPDATE ON public.components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for component files
INSERT INTO storage.buckets (id, name, public) VALUES ('component-files', 'component-files', true);

-- Storage RLS
CREATE POLICY "Users can upload component files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'component-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own component files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'component-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view component files" ON storage.objects
  FOR SELECT USING (bucket_id = 'component-files');

CREATE POLICY "Users can delete own component files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'component-files' AND (storage.foldername(name))[1] = auth.uid()::text);
