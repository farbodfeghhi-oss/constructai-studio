UPDATE public.ai_role_plans
SET models = jsonb_set(jsonb_set(models, '{document}', '"pplx-embed-v1-4b"'), '{query}', '"pplx-embed-v1-4b"'),
    updated_at = now()
WHERE key = 'solidedge_rag_search';