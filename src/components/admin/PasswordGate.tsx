import { useState } from "react";
import { Shield, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAdminSession } from "@/hooks/useAdminSession";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const { isUnlocked, unlock, lock } = useAdminSession();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  if (isUnlocked) {
    return (
      <div>
        <div className="flex items-center justify-end mb-4">
          <Button variant="outline" size="sm" onClick={lock} className="gap-2 text-xs">
            <Lock className="h-3 w-3" /> Sperren
          </Button>
        </div>
        {children}
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwd) return;
    setBusy(true);
    const ok = await unlock(pwd);
    setBusy(false);
    if (!ok) toast({ title: "Falsches Passwort", variant: "destructive" });
    else toast({ title: "Zugriff freigegeben (30 Min)" });
    setPwd("");
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="rounded-xl border border-accent/30 bg-card p-8 shadow-xl">
        <div className="h-12 w-12 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center mx-auto mb-4">
          <Shield className="h-6 w-6 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-center text-foreground">Geschützter Bereich</h2>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          AI Rollen-Konfiguration · Admin-Passwort erforderlich
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            placeholder="Admin-Passwort"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoFocus
            className="text-center font-mono tracking-widest"
          />
          <Button type="submit" disabled={busy || !pwd} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Entsperren
          </Button>
        </form>
      </div>
    </div>
  );
}
