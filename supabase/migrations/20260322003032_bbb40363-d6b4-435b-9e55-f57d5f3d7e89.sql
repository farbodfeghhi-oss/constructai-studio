
CREATE TABLE public.solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  projekt_name text,
  anforderungen text NOT NULL,
  provider text,
  loesungen jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_response text
);

ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own solutions" ON public.solutions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own solutions" ON public.solutions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own solutions" ON public.solutions FOR DELETE TO authenticated USING (auth.uid() = user_id);
