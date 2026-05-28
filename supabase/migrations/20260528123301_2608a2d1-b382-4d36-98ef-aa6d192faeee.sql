
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ dashboard_assets ============
CREATE TABLE public.dashboard_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  image_url text NOT NULL,
  prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_assets TO authenticated;
GRANT ALL ON public.dashboard_assets TO service_role;

ALTER TABLE public.dashboard_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dashboard assets" ON public.dashboard_assets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own dashboard assets" ON public.dashboard_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own dashboard assets" ON public.dashboard_assets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own dashboard assets" ON public.dashboard_assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ ai_role_plans ============
CREATE TABLE public.ai_role_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  provider_mode text NOT NULL,
  models jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_prompt text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_builtin boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_role_plans TO authenticated;
GRANT ALL ON public.ai_role_plans TO service_role;

ALTER TABLE public.ai_role_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read role plans" ON public.ai_role_plans
  FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE/DELETE policies => only service_role (via edge fn) can mutate.

CREATE TRIGGER update_ai_role_plans_updated_at
  BEFORE UPDATE ON public.ai_role_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure exactly one active plan
CREATE UNIQUE INDEX ai_role_plans_one_active
  ON public.ai_role_plans ((is_active)) WHERE is_active = true;

-- ============ app_settings ============
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No grants to anon/authenticated: only service_role
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- No policies => locked to service_role only.

-- ============ Seeds ============
INSERT INTO public.app_settings (key, value) VALUES
  ('admin_pass_hash', crypt('81665060', gen_salt('bf', 12)));

INSERT INTO public.ai_role_plans (key, name, description, provider_mode, models, system_prompt, is_active) VALUES
('sheet_metal_expert', 'Sheet Metal Expert',
 'Spezialisiert auf Blechkonstruktion nach DIN/ISO/EN Standards mit Solid Edge Fokus.',
 'perplexity+monica',
 '{"perplexity":"sonar-pro","monica":"claude-sonnet-4"}',
 'You are a senior sheet-metal design engineer (15+ years) specialized in DIN/ISO/EN standards and Solid Edge. Always cite the relevant DIN norm. Output 3 solutions: Best, Budget, Performance.',
 true),

('cost_optimizer', 'Cost Optimizer',
 'Lieferantenrecherche und Kostenoptimierung mit BOM-Erzeugung.',
 'perplexity+monica',
 '{"perplexity":"sonar-pro","monica":"claude-sonnet-4"}',
 'You are a cost optimization engineer. Use real-time supplier research to propose the cheapest verified BOM (with sources, prices, MOQ) without sacrificing technical requirements.',
 false),

('standards_auditor', 'Standards Auditor',
 'Tiefgehende Normen- und Compliance-Prüfung (DIN/ISO/EN/ASME).',
 'perplexity-only',
 '{"perplexity":"sonar-deep-research"}',
 'You are a standards compliance auditor. Perform a deep, sourced review of the design against DIN, ISO, EN and ASME requirements. Return a structured audit with citations.',
 false),

('rapid_prototype', 'Rapid Prototype',
 'Schnelle Lösungsvorschläge ohne Web-Recherche.',
 'monica-only',
 '{"monica":"claude-sonnet-4"}',
 'You are a fast prototyping engineer. Deliver pragmatic, buildable concepts in under 60 seconds. Do not waste tokens on research; rely on internal knowledge.',
 false),

('senior_optimizer', 'Senior Mechanical Engineer',
 'Optimiert Funktionalität, Fertigbarkeit und Kosten des aktuellen Designs.',
 'monica-only',
 '{"monica":"claude-sonnet-4"}',
 'Act as a Senior Mechanical Engineer. Analyze the current mechanical design project and propose technical optimizations to enhance functionality, manufacturability, and cost-efficiency.',
 false),

('tech_doc_generator', 'Technical Doc Processor',
 'Erzeugt technische Dokumentation in Industriestandard-Formatierung.',
 'perplexity+monica',
 '{"perplexity":"sonar-pro","monica":"claude-sonnet-4"}',
 'Based on the user instructions, technically process the current engineering project and generate the requested technical documentation with high precision and industry-standard formatting.',
 false),

('bom_strict', 'BOM & Drawing Spec (RAG-strict)',
 'Strict-RAG: generiert Zeichnungs-Specs und BOM NUR aus Kontext + Wissensbasis.',
 'monica-only',
 '{"monica":"claude-sonnet-4"}',
 'Relying strictly on the provided information and the linked knowledge base, generate the specifications for the technical drawings and the corresponding Bill of Materials (BOM). Do not use external assumptions or hallucinate data outside the provided context.',
 false),

('design_lead_review', 'Design Lead Review',
 'Final-Release-Review gegen DIN-Normen + Mängelreport.',
 'perplexity+monica',
 '{"perplexity":"sonar-deep-research","monica":"claude-sonnet-4"}',
 'Act as an Expert Mechanical Engineering Design Lead. Review the uploaded technical drawings for final release approval, strictly cross-referencing them against the linked DIN standards and provided reference materials. Provide a highly professional, clear, and precise report detailing any missing features, required corrections, or necessary design adjustments.',
 false);
