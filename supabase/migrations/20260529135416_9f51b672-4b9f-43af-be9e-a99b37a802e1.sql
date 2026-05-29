ALTER TABLE public.analysis_runs RENAME COLUMN gemini_blueprint TO design_blueprint;
ALTER TABLE public.analysis_runs RENAME COLUMN perplexity_validation TO standards_validation;
ALTER TABLE public.analysis_runs RENAME COLUMN monica_report TO final_report;

ALTER TABLE public.analysis_runs ALTER COLUMN phase_status SET DEFAULT '{"aggregator": {"status": "pending"}, "design": {"status": "pending"}, "standards": {"status": "pending"}, "docgen": {"status": "pending"}}'::jsonb;