// Anti-hallucination block reused by all role plans.
// IMPORTANT: search filters (domains, recency) are API parameters, NEVER prompt text.

export const ANTI_HALLUCINATION = `
- Wenn die Quellenlage zu dünn ist, sage explizit: "Keine belastbaren Quellen gefunden."
- Kennzeichne ähnliche, nicht exakt passende Treffer als [NEAR-MATCH] und erkläre die Abweichung.
- Erfinde NIEMALS Normnummern, Werkstoff-Nummern, Preise oder Lieferantennamen.
- Frage niemals nach URLs im Text – Quellen werden vom System aus dem strukturierten Payload geliefert.
`.trim();

// Helper: load active role plan or a specific key from DB (used by edge functions)
export async function loadRolePlan(
  admin: { from: (t: string) => any },
  key?: string,
): Promise<any> {
  const q = admin.from("ai_role_plans").select("*");
  const { data, error } = key
    ? await q.eq("key", key).maybeSingle()
    : await q.eq("is_active", true).maybeSingle();
  if (error) throw new Error(`loadRolePlan: ${error.message}`);
  return data;
}
