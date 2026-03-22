
CREATE TABLE public.knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  content_type text NOT NULL DEFAULT 'other',
  file_url text,
  link_url text,
  extracted_text text,
  ai_summary text,
  keywords text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knowledge" ON public.knowledge_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge" ON public.knowledge_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge" ON public.knowledge_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge" ON public.knowledge_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
