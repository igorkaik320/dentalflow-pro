import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Activity, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import controlClinicMark from "@/assets/controlclinic-mark.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { toast } from "sonner";

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <div className="controlclinic-login min-h-svh flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-10">
        <a href="/login" className="flex items-center gap-2.5" aria-label="ControlClinic — início">
          <img src={controlClinicMark} alt="" width={1024} height={1024} className="h-9 w-9 object-contain" />
          <span className="text-xl font-semibold">Control<span className="text-primary">Clinic</span></span>
        </a>
        <span className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Área restrita</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-5 pb-6 text-xs text-muted-foreground">
        <span>ControlClinic</span>
        <span className="flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" />Acesso seguro</span>
      </footer>
    </div>
  );
}

function CompactBrand({ title, subtitle, icon: Icon = Activity }: { title: string; subtitle: string; icon?: typeof Activity }) {
  return (
    <div className="mb-7">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/15 bg-primary/5">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, accessError, signOut } = useClinic();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [passwordSetupMode, setPasswordSetupMode] = useState(() => new URLSearchParams(location.search).get("set-password") === "1");
  const [setupEmail, setSetupEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

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
      <LoginShell>
        <div className="max-w-md mx-auto">
          <CompactBrand title="Cadastrar senha" subtitle="Defina sua senha para acessar a clínica." icon={LockKeyhole} />
          <form className="space-y-4" onSubmit={handleSetPassword}>
            <div><Label>Nova senha</Label><Input name="newPassword" type="password" autoComplete="new-password" /></div>
            <div><Label>Confirmação de senha</Label><Input name="confirmPassword" type="password" autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Salvando..." : "Cadastrar senha"}</Button>
          </form>
        </div>
      </LoginShell>
    );
  }

  if (session && accessError) {
    return (
      <LoginShell>
        <div className="max-w-md mx-auto">
          <CompactBrand title="Acesso em análise" subtitle="Seu cadastro precisa ser aprovado pela clínica." icon={ShieldCheck} />
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground mb-5">
            {accessError}
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
        </div>
      </LoginShell>
    );
  }

  if (session && location.pathname === "/login") return <Navigate to="/" replace />;
  if (session) return <>{children}</>;

  return (
    <LoginShell>
      <div className="max-w-md mx-auto">
        <CompactBrand title="Bem-vindo ao ControlClinic" subtitle="Entre na sua conta para continuar." icon={LockKeyhole} />

        {passwordSetupMode ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-primary mb-5">
            Enviamos o link para criar senha{setupEmail ? ` em ${setupEmail}` : ""}. Abra o email e volte por ele para cadastrar sua senha.
          </div>
        ) : null}

        <Button variant="outline" className="w-full h-11" onClick={handleGoogle} disabled={submitting}>
          <span className="mr-2 text-base font-bold text-primary" aria-hidden="true">G</span>
          Entrar com Google
        </Button>
        <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou com email<span className="h-px flex-1 bg-border" /></div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Cadastrar</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form className="space-y-4 mt-4" onSubmit={(event) => handleEmailAuth(event, "login")}>
              <div className="space-y-2"><Label htmlFor="login-email">Email</Label><Input id="login-email" name="email" type="email" autoComplete="email" placeholder="Seu email" className="h-11" /></div>
              <div className="space-y-2"><Label htmlFor="login-password">Senha</Label><div className="relative"><Input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" className="h-11 pr-12" /><Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-0.5 h-10 w-10 text-muted-foreground" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} title={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div><p className="text-xs text-muted-foreground">Primeiro acesso? Deixe a senha em branco.</p></div>
              <Button type="submit" className="w-full h-11" disabled={submitting}>
                {submitting ? "Entrando..." : <><span>Entrar</span><ArrowRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form className="space-y-4 mt-4" onSubmit={(event) => handleEmailAuth(event, "signup")}>
              <div className="space-y-2"><Label htmlFor="signup-name">Nome</Label><Input id="signup-name" name="fullName" autoComplete="name" className="h-11" /></div>
              <div className="space-y-2"><Label htmlFor="signup-email">Email</Label><Input id="signup-email" name="email" type="email" autoComplete="email" className="h-11" /></div>
              <div className="space-y-2"><Label htmlFor="signup-password">Senha</Label><Input id="signup-password" name="password" type="password" autoComplete="new-password" className="h-11" /></div>
              <Button type="submit" className="w-full h-11" disabled={submitting}>{submitting ? "Cadastrando..." : "Solicitar acesso"}</Button>
              <p className="text-xs leading-5 text-muted-foreground">
                A solicitação será enviada para aprovação de um administrador.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </LoginShell>
  );
}
