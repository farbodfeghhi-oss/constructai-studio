ALTER TABLE public.analysis_runs ADD COLUMN IF NOT EXISTS verification_blueprint jsonb;

ALTER TABLE public.analysis_runs ALTER COLUMN phase_status SET DEFAULT '{"aggregator":{"status":"pending"},"design":{"status":"pending"},"verification":{"status":"pending"},"standards":{"status":"pending"},"docgen":{"status":"pending"}}'::jsonb;

UPDATE public.analysis_runs
SET phase_status = phase_status || '{"verification":{"status":"pending"}}'::jsonb
WHERE NOT (phase_status ? 'verification');