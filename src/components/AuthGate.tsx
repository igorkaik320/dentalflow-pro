import { FormEvent, ReactNode, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useClinic();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (session && location.pathname === "/login") return <Navigate to="/" replace />;
  if (session) return <>{children}</>;

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>, mode: "login" | "signup") => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const fullName = String(form.get("fullName") || "").trim();

    if (!email || !password) {
      toast.error("Informe email e senha.");
      return;
    }

    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
        });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(mode === "login" ? "Login realizado com sucesso." : "Cadastro criado. Verifique seu email para confirmar o acesso.");
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    setSubmitting(false);
    if (error) toast.error(error.message || "Não foi possível iniciar o login com Google.");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 shadow-elegant">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">EsteticaPro</h1>
            <p className="text-sm text-muted-foreground">Acesse sua clínica para continuar</p>
          </div>
        </div>

        <Button variant="outline" className="w-full mb-5" onClick={handleGoogle} disabled={submitting}>
          Entrar com Google
        </Button>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Cadastrar</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form className="space-y-4 mt-4" onSubmit={(event) => handleEmailAuth(event, "login")}>
              <div><Label>Email</Label><Input name="email" type="email" autoComplete="email" /></div>
              <div><Label>Senha</Label><Input name="password" type="password" autoComplete="current-password" /></div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Entrando..." : "Entrar"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form className="space-y-4 mt-4" onSubmit={(event) => handleEmailAuth(event, "signup")}>
              <div><Label>Nome</Label><Input name="fullName" autoComplete="name" /></div>
              <div><Label>Email</Label><Input name="email" type="email" autoComplete="email" /></div>
              <div><Label>Senha</Label><Input name="password" type="password" autoComplete="new-password" /></div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Cadastrando..." : "Criar acesso"}</Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
