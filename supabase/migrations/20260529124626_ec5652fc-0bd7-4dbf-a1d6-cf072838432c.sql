ALTER TABLE public.ai_role_plans DROP CONSTRAINT IF EXISTS ai_role_plans_one_active;
DROP INDEX IF EXISTS public.ai_role_plans_one_active;