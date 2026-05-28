
-- 1. analysis_runs table
CREATE TABLE public.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  reference_ids uuid[] NOT NULL DEFAULT '{}',
  file_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',
  current_phase text NOT NULL DEFAULT 'aggregator',
  phase_status jsonb NOT NULL DEFAULT '{"aggregator":{"status":"pending"},"gemini":{"status":"pending"},"perplexity":{"status":"pending"},"monica":{"status":"pending"}}'::jsonb,
  gemini_blueprint jsonb,
  perplexity_validation jsonb,
  monica_report text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_runs TO authenticated;
GRANT ALL ON public.analysis_runs TO service_role;

ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own analysis runs" ON public.analysis_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own analysis runs" ON public.analysis_runs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own analysis runs" ON public.analysis_runs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own analysis runs" ON public.analysis_runs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_analysis_runs_updated_at
  BEFORE UPDATE ON public.analysis_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_runs;
ALTER TABLE public.analysis_runs REPLICA IDENTITY FULL;

-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('analysis-uploads', 'analysis-uploads', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users view own analysis uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'analysis-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own analysis uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'analysis-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own analysis uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'analysis-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
