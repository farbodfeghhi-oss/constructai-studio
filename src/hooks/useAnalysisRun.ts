import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PhaseKey = "aggregator" | "design" | "verification" | "standards" | "docgen";
export type PhaseState = { status: "pending" | "running" | "done" | "error"; error?: string };

export interface AnalysisRun {
  id: string;
  user_id: string;
  prompt: string;
  reference_ids: string[];
  file_paths: string[];
  status: "queued" | "running" | "done" | "error";
  current_phase: PhaseKey | "done";
  phase_status: Record<PhaseKey, PhaseState>;
  design_blueprint: any;
  verification_blueprint: any;
  docgen_blueprint: any;
  standards_validation: any;
  final_report: string | null;
  error: string | null;
  plan_id: string | null;
  plan_key: string | null;
  plan_name: string | null;
  models_used: Record<string, string> | null;
  generated_images: Array<{ url: string; path?: string; prompt: string; kind: string; label?: string; created_at: string }> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAnalysisRun(runId: string | null) {
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRun = useCallback(async (id: string) => {
    const { data } = await supabase.from("analysis_runs").select("*").eq("id", id).maybeSingle();
    if (data) setRun(data as unknown as AnalysisRun);
  }, []);

  useEffect(() => {
    if (!runId) { setRun(null); return; }
    setLoading(true);
    fetchRun(runId).finally(() => setLoading(false));

    const channel = supabase
      .channel(`analysis_run_${runId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "analysis_runs", filter: `id=eq.${runId}` },
        (payload) => setRun(payload.new as unknown as AnalysisRun))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId, fetchRun]);

  return { run, loading, refetch: () => runId && fetchRun(runId) };
}
