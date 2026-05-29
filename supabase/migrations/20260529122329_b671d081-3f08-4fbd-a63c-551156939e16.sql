
ALTER TABLE public.ai_role_plans
  ADD COLUMN IF NOT EXISTS api_mode text NOT NULL DEFAULT 'sync',
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS search_domain_filter text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_mode text,
  ADD COLUMN IF NOT EXISTS response_format jsonb,
  ADD COLUMN IF NOT EXISTS tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_steps int,
  ADD COLUMN IF NOT EXISTS supports_multimodal boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.deep_research_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  perplexity_request_id text NOT NULL,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deep_research_jobs TO authenticated;
GRANT ALL ON public.deep_research_jobs TO service_role;

ALTER TABLE public.deep_research_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deep research jobs"
  ON public.deep_research_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own deep research jobs"
  ON public.deep_research_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own deep research jobs"
  ON public.deep_research_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own deep research jobs"
  ON public.deep_research_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_deep_research_jobs_updated_at
  BEFORE UPDATE ON public.deep_research_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS deep_research_jobs_user_idx ON public.deep_research_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deep_research_jobs_request_idx ON public.deep_research_jobs(perplexity_request_id);

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.knowledge_items
  ADD COLUMN IF NOT EXISTS embedding vector(2560),
  ADD COLUMN IF NOT EXISTS embedding_model text;

CREATE OR REPLACE FUNCTION public.match_knowledge_items(
  query_embedding vector(2560),
  match_count int DEFAULT 5,
  p_user_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  title text,
  ai_summary text,
  category text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    k.id,
    k.title,
    k.ai_summary,
    k.category,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_items k
  WHERE k.embedding IS NOT NULL
    AND (p_user_id IS NULL OR k.user_id = p_user_id)
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;
