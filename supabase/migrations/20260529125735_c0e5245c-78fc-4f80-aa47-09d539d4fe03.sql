-- Fix 1: Remove duplicate SELECT policy on component-files
DROP POLICY IF EXISTS "Users can view their own component files" ON storage.objects;

-- Fix 2: Add service-role-only policies for app_settings (admin-only config table)
CREATE POLICY "Service role manages app_settings"
ON public.app_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix 3: Restrict Realtime subscriptions so users only receive their own channel topics
-- Topic convention: analysis_run_{run_id} (matches src/hooks/useAnalysisRun.ts)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own analysis_run realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'analysis_run_%' THEN EXISTS (
      SELECT 1 FROM public.analysis_runs r
      WHERE r.id::text = substring(realtime.topic() FROM 'analysis_run_(.+)')
        AND r.user_id = auth.uid()
    )
    WHEN realtime.topic() LIKE 'deep_research_%' THEN EXISTS (
      SELECT 1 FROM public.deep_research_jobs j
      WHERE j.id::text = substring(realtime.topic() FROM 'deep_research_(.+)')
        AND j.user_id = auth.uid()
    )
    ELSE true
  END
);
