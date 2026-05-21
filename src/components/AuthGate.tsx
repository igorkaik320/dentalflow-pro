import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { toast } from "sonner";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, accessError, signOut } = useClinic();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [passwordSetupMode, setPasswordSetupMode] = useState(() => new URLSearchParams(location.search).get("set-password") === "1");
  const [setupEmail, setSetupEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("set-password") === "1") setPasswordSetupMode(true);
  }, [location.search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>, mode: "login" | "signup") => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const fullName = String(form.get("fullName") || "").trim();

    if (!email) {
      toast.error("Informe o email.");
      return;
    }

    if (mode === "login" && !password) {
      setSubmitting(true);
      const { error } = await supabase.functions.invoke("manage-clinic-users", {
        body: {
          action: "request-password-setup",
          email,
          redirectTo: `${window.location.origin}/login?set-password=1`,
        },
      });
      setSubmitting(false);
      if (error) return toast.error("Acesso sem senha permitido somente no primeiro acesso.");
      setSetupEmail(email);
      setPasswordSetupMode(true);
      toast.success("Enviamos o acesso para criar senha no email informado.");
      return;
    }

    if (!password) {
      toast.error("Informe a senha.");
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

    toast.success(mode === "login" ? "Login realizado com sucesso." : "Solicitacao enviada. Aguarde um administrador aprovar seu acesso.");
  };

  const handleSetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (!session) {
      toast.error("Abra o link enviado por email para cadastrar a senha.");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("A confirmacao de senha nao confere.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) await db.from("profiles").update({ password_setup_required: false }).eq("user_id", session.user.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setPasswordSetupMode(false);
    toast.success("Senha cadastrada. Acesso liberado.");
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/`,
    });
    if (result.redirected) return;
    setSubmitting(false);
    if (result.error) toast.error(result.error.message || "Nao foi possivel iniciar o login com Google.");
  };

  if (session && passwordSetupMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 shadow-elegant">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Cadastrar senha</h1>
              <p className="text-sm text-muted-foreground">Defina sua senha para acessar a clinica.</p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={handleSetPassword}>
            <div><Label>Nova senha</Label><Input name="newPassword" type="password" autoComplete="new-password" /></div>
            <div><Label>Confirmacao de senha</Label><Input name="confirmPassword" type="password" autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Salvando..." : "Cadastrar senha"}</Button>
          </form>
        </Card>
      </div>
    );
  }

  if (session && accessError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6 shadow-elegant">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Acesso em analise</h1>
              <p className="text-sm text-muted-foreground">Seu cadastro precisa ser aprovado pela clinica.</p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground mb-5">
            {accessError}
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
        </Card>
      </div>
    );
  }

  if (session && location.pathname === "/login") return <Navigate to="/" replace />;
  if (session) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 shadow-elegant">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">EsteticaPro</h1>
            <p className="text-sm text-muted-foreground">Acesse sua clinica para continuar</p>
          </div>
        </div>

        {passwordSetupMode ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground mb-5">
            Enviamos o link para criar senha{setupEmail ? ` em ${setupEmail}` : ""}. Abra o email e volte por ele para cadastrar sua senha.
          </div>
        ) : null}

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
              <div><Label>Senha</Label><Input name="password" type="password" autoComplete="current-password" placeholder="Deixe vazio para criar senha" /></div>
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
