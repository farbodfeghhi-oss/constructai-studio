import { useCallback, useEffect, useState } from "react";
import { PasswordGate } from "@/components/admin/PasswordGate";
import { RolePlanCard, type RolePlan } from "@/components/admin/RolePlanCard";
import { useAdminSession } from "@/hooks/useAdminSession";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";

function RolesContent() {
  const { password } = useAdminSession();
  const [plans, setPlans] = useState<RolePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ai_role_plans")
      .select("id, key, name, description, provider_mode, models, system_prompt, is_active, api_mode, endpoint, search_domain_filter, search_mode, response_format, tools, max_steps, supports_multimodal")
      .order("is_active", { ascending: false })
      .order("name");
    setPlans((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-accent text-xs uppercase tracking-widest font-mono mb-2">
          <Shield className="h-3.5 w-3.5" /> Admin · AI Roles
        </div>
        <h1 className="text-3xl font-bold text-foreground">AI Rollen-Manager</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Vordefinierte Backend-Personas. Die aktive Rolle steuert den System-Prompt und den Provider-Mix aller AI-Calls in der gesamten Plattform.
        </p>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Lade…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((p) => (
            <RolePlanCard key={p.id} plan={p} password={password ?? ""} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AiRoles() {
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PasswordGate>
        <RolesContent />
      </PasswordGate>
    </div>
  );
}
