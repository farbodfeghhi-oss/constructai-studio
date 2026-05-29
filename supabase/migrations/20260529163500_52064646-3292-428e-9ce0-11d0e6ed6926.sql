ALTER TABLE public.analysis_runs ADD COLUMN IF NOT EXISTS standards_request_id text;

UPDATE public.analysis_runs
SET status = 'error',
    error = 'Cancelled: Standards Deep Research timeout (manual cancel)',
    phase_status = jsonb_set(phase_status, '{standards}', '{"status":"error","error":"Cancelled by user after timeout"}'::jsonb)
WHERE status = 'running'
  AND current_phase = 'standards'
  AND updated_at < now() - interval '15 minutes';