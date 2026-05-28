import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "mechai_admin_session";
const TTL_MS = 30 * 60 * 1000; // 30 min

type Session = { password: string; expiresAt: number };

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (Date.now() > s.expiresAt) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(() => read());

  useEffect(() => {
    const t = setInterval(() => {
      const s = read();
      if (!s && session) setSession(null);
    }, 60_000);
    return () => clearInterval(t);
  }, [session]);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("verify-admin-pass", { body: { password } });
    if (error || !data?.ok) return false;
    const s: Session = { password, expiresAt: Date.now() + TTL_MS };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
    return true;
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setSession(null);
  }, []);

  return { isUnlocked: !!session, password: session?.password ?? null, unlock, lock };
}
