import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Loader2 } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Registrierung erfolgreich!",
          description: "Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link in Ihrer Inbox.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Authentifizierung fehlgeschlagen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Fehler", description: "Bitte geben Sie Ihre E-Mail ein.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "E-Mail gesendet",
        description: "Prüfen Sie Ihre Inbox für den Link zum Zurücksetzen.",
      });
      setShowForgot(false);
    } catch (error: any) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
              <Settings className="h-6 w-6 text-accent-foreground" />
            </div>
          </div>
          <CardTitle asChild className="text-xl">
            <h1>{showForgot ? "Passwort zurücksetzen" : isLogin ? "Bei MechAI anmelden" : "MechAI-Konto erstellen"}</h1>
          </CardTitle>
          <CardDescription>
            {showForgot
              ? "Geben Sie Ihre E-Mail ein, um einen Reset-Link zu erhalten."
              : isLogin
              ? "Melden Sie sich bei MechAI an"
              : "Erstellen Sie Ihr MechAI-Konto"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Reset-Link senden
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setShowForgot(false)}>
                Zurück zur Anmeldung
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Anzeigename</Label>
                  <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Max Mustermann" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isLogin ? "Anmelden" : "Registrieren"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <Button type="button" variant="link" className="p-0 h-auto" onClick={() => setIsLogin(!isLogin)}>
                  {isLogin ? "Konto erstellen" : "Bereits registriert?"}
                </Button>
                {isLogin && (
                  <Button type="button" variant="link" className="p-0 h-auto" onClick={() => setShowForgot(true)}>
                    Passwort vergessen?
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
