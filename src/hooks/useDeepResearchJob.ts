import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DeepResearchStatus = "pending" | "in_progress" | "completed" | "failed";

export interface DeepResearchJob {
  id: string;
  perplexity_request_id: string;
  prompt: string;
  status: DeepResearchStatus;
  result: any | null;
  citations: any[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Submit and track a sonar-deep-research async job.
 * Combines initial Realtime subscription + 5s polling fallback (TTL 7 days, well within range).
 */
export function useDeepResearchJob() {
  const [job, setJob] = useState<DeepResearchJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async (jobId: string) => {
    const { data, error: pollErr } = await supabase.functions.invoke("agent-standards-poll", {
      body: { job_id: jobId },
    });
    if (pollErr) {
      setError(pollErr.message);
      return null;
    }
    const fresh = (data as any)?.job as DeepResearchJob | undefined;
    if (fresh) {
      setJob(fresh);
      if (fresh.status === "completed" || fresh.status === "failed") {
        clearTimers();
      }
      return fresh;
    }
    return null;
  }, [clearTimers]);

  const submit = useCallback(async (prompt: string, options?: { search_domain_filter?: string[] }) => {
    setSubmitting(true);
    setError(null);
    setJob(null);
    clearTimers();

    const { data, error: invokeErr } = await supabase.functions.invoke("agent-standards", {
      body: { prompt, ...options },
    });
    setSubmitting(false);

    if (invokeErr || (data as any)?.error) {
      const msg = (data as any)?.error ?? invokeErr?.message ?? "Submission failed";
      setError(msg);
      return null;
    }

    const newJob = (data as any).job as DeepResearchJob;
    setJob(newJob);

    // Realtime subscription
    const channel = supabase
      .channel(`deep_research:${newJob.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deep_research_jobs", filter: `id=eq.${newJob.id}` },
        (payload) => {
          const updated = payload.new as DeepResearchJob;
          setJob(updated);
          if (updated.status === "completed" || updated.status === "failed") {
            clearTimers();
          }
        },
      )
      .subscribe();
    channelRef.current = channel;

    // 5s polling fallback
    pollRef.current = window.setInterval(() => {
      pollOnce(newJob.id);
    }, 5000);

    return newJob;
  }, [clearTimers, pollOnce]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { job, submit, submitting, error, pollOnce };
}
