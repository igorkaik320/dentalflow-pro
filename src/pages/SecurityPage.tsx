import { useEffect, useState } from "react";
import { KeyRound, Shield, UserPlus } from "lucide-react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { db } from "@/lib/clinicCloud";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "reception" | "dentist" | "finance";

type ClinicMember = {
  id: string;
  userId: string;
  role: Role;
  active: boolean;
  email: string;
  fullName: string;
};

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  reception: "Recepcao",
  dentist: "Especialista",
  finance: "Financeiro",
};

function mapMember(row: any, profile?: any): ClinicMember {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role || "reception",
    active: Boolean(row.active),
    email: profile?.email || "",
    fullName: profile?.full_name || profile?.email || "Usuario",
  };
}

export default function SecurityPage() {
  const { clinic, user } = useClinic();
  const [members, setMembers] = useState<ClinicMember[]>([]);
  const [memberFullName, setMemberFullName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("reception");
  const [memberPassword, setMemberPassword] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [confirmUserPassword, setConfirmUserPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!clinic.id) return;
    void loadMembers();
  }, [clinic.id]);

  const loadMembers = async () => {
    if (!clinic.id) return;
    const { data: memberRows, error } = await db
      .from("clinic_members")
      .select("id, user_id, role, active, created_at")
      .eq("clinic_id", clinic.id)
      .order("created_at");
    if (error) return toast.error("Nao foi possivel carregar os usuarios.");

    const userIds = (memberRows || []).map((row: any) => row.user_id).filter(Boolean);
    let profileRows: any[] = [];
    if (userIds.length) {
      const profilesRes = await db.from("profiles").select("user_id, email, full_name").in("user_id", userIds);
      if (profilesRes.error) toast.error("Nao foi possivel carregar os perfis dos usuarios.");
      profileRows = profilesRes.data || [];
    }
    const profilesByUser = new Map(profileRows.map((profile) => [profile.user_id, profile]));
    setMembers((memberRows || []).map((member: any) => mapMember(member, profilesByUser.get(member.user_id))));
  };

  const createMember = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada.");
    const email = memberEmail.trim().toLowerCase();
    const fullName = memberFullName.trim();
    if (!fullName || !email) return toast.error("Informe nome completo e email.");
    if (memberPassword && memberPassword.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres.");

    setSavingMember(true);
    const { error } = await supabase.functions.invoke("manage-clinic-users", {
      body: {
        action: "create-user",
        clinicId: clinic.id,
        fullName,
        email,
        role: memberRole,
        password: memberPassword,
      },
    });
    setSavingMember(false);
    if (error) return toast.error(error.message || "Nao foi possivel cadastrar o usuario.");

    setMemberFullName("");
    setMemberEmail("");
    setMemberPassword("");
    toast.success(memberPassword ? "Usuario cadastrado." : "Usuario cadastrado para primeiro acesso.");
    await loadMembers();
  };

  const updateMember = async (member: ClinicMember, changes: Partial<Pick<ClinicMember, "role" | "active">>) => {
    if (!clinic.id) return;
    const { error } = await db.from("clinic_members").update(changes).eq("id", member.id).eq("clinic_id", clinic.id);
    if (error) return toast.error("Nao foi possivel atualizar o usuario.");
    setMembers((prev) => prev.map((item) => item.id === member.id ? { ...item, ...changes } : item));
  };

  const changeUserPassword = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada.");
    if (!passwordUserId || !newUserPassword || !confirmUserPassword || !adminPassword) return toast.error("Preencha todos os campos da troca de senha.");
    if (newUserPassword !== confirmUserPassword) return toast.error("A confirmacao de senha nao confere.");
    if (newUserPassword.length < 6) return toast.error("A nova senha precisa ter pelo menos 6 caracteres.");

    setChangingPassword(true);
    const { error } = await supabase.functions.invoke("manage-clinic-users", {
      body: {
        action: "change-password",
        clinicId: clinic.id,
        userId: passwordUserId,
        newPassword: newUserPassword,
        confirmPassword: confirmUserPassword,
        adminPassword,
      },
    });
    setChangingPassword(false);
    if (error) return toast.error(error.message || "Nao foi possivel alterar a senha.");

    setPasswordUserId("");
    setNewUserPassword("");
    setConfirmUserPassword("");
    setAdminPassword("");
    toast.success("Senha alterada.");
  };

  return (
    <ClinicLayout title="Seguranca" subtitle="Usuarios, acessos e senhas da clinica">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 max-w-6xl animate-fade-in">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-4 w-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">Cadastrar Usuario</h3>
                <p className="text-xs text-muted-foreground">Crie usuarios da clinica e defina o cargo de acesso.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Nome completo</Label><Input value={memberFullName} onChange={(e) => setMemberFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} /></div>
              <div>
                <Label>Cargo/Funcao</Label>
                <Select value={memberRole} onValueChange={(role: Role) => setMemberRole(role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(roleLabels).map(([role, label]) => <SelectItem key={role} value={role}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Senha opcional</Label><Input type="password" value={memberPassword} onChange={(e) => setMemberPassword(e.target.value)} placeholder="Deixe vazio para primeiro acesso" /></div>
            </div>
            <Button onClick={createMember} disabled={savingMember} className="mt-4">{savingMember ? "Cadastrando..." : "Cadastrar Usuario"}</Button>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">Usuarios da Clinica</h3>
                <p className="text-xs text-muted-foreground">Controle cargos e usuarios ativos.</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Usuario</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Cargo/Funcao</th><th className="text-center text-xs font-medium text-muted-foreground p-3">Ativo</th></tr></thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-border/50">
                      <td className="p-3"><p className="text-sm font-medium text-foreground">{member.fullName}</p><p className="text-xs text-muted-foreground">{member.email}</p></td>
                      <td className="p-3">
                        <Select value={member.role} onValueChange={(role: Role) => updateMember(member, { role })}>
                          <SelectTrigger className="max-w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(roleLabels).map(([role, label]) => <SelectItem key={role} value={role}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-center"><Switch checked={member.active} disabled={member.userId === user?.id} onCheckedChange={(active) => updateMember(member, { active })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">Alterar Senha</h3>
              <p className="text-xs text-muted-foreground">Somente administradores podem alterar senhas.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label>Usuario</Label>
              <Select value={passwordUserId} onValueChange={setPasswordUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuario" /></SelectTrigger>
                <SelectContent>{members.map((member) => <SelectItem key={member.userId} value={member.userId}>{member.fullName} - {member.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nova senha</Label><Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} /></div>
            <div><Label>Confirmacao de senha</Label><Input type="password" value={confirmUserPassword} onChange={(e) => setConfirmUserPassword(e.target.value)} /></div>
            <div><Label>Senha do administrador</Label><Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></div>
            <Button onClick={changeUserPassword} disabled={changingPassword} className="w-full">{changingPassword ? "Alterando..." : "Alterar Senha"}</Button>
          </div>
        </Card>
      </div>
    </ClinicLayout>
  );
}
