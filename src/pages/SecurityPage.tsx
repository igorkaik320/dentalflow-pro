import { useEffect, useState } from "react";
import { KeyRound, Shield, UserPlus } from "lucide-react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { db } from "@/lib/clinicCloud";
import { supabase } from "@/integrations/supabase/client";
import {
  buildRolePermissions,
  fullModulePermissions,
  mergePermissionRows,
  permissionActions,
  permissionModules,
  type PermissionAction,
  type PermissionMap,
  type PermissionModule,
} from "@/lib/permissions";

type Role = "admin" | "reception" | "dentist" | "finance";

type ClinicMember = {
  id: string;
  userId: string;
  role: Role;
  active: boolean;
  email: string;
  fullName: string;
  permissions: PermissionMap;
};

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  reception: "Recepcao",
  dentist: "Especialista",
  finance: "Financeiro",
};

function mapMember(row: any, profile?: any, permissionRows: any[] = []): ClinicMember {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role || "reception",
    active: Boolean(row.active),
    email: profile?.email || "",
    fullName: profile?.full_name || profile?.email || "Usuario",
    permissions: mergePermissionRows(row.role || "reception", permissionRows),
  };
}

export default function SecurityPage() {
  const { clinic, user } = useClinic();
  const [members, setMembers] = useState<ClinicMember[]>([]);
  const [memberFullName, setMemberFullName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("reception");
  const [memberPassword, setMemberPassword] = useState("");
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [confirmUserPassword, setConfirmUserPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!clinic.id) return;
    void loadMembers();
  }, [clinic.id]);

  const selectedMember = members.find((member) => member.id === selectedMemberId) || members[0] || null;

  useEffect(() => {
    if (!members.length) {
      setSelectedMemberId("");
      return;
    }
    if (!selectedMemberId || !members.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(members[0].id);
    }
  }, [members, selectedMemberId]);

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
    const memberIds = (memberRows || []).map((row: any) => row.id);
    let permissionRows: any[] = [];
    if (memberIds.length) {
      const permissionRes = await db
        .from("clinic_member_permissions")
        .select("member_id, module, can_view, can_create, can_update, can_delete")
        .eq("clinic_id", clinic.id)
        .in("member_id", memberIds);
      if (permissionRes.error) toast.error("Nao foi possivel carregar as permissoes.");
      permissionRows = permissionRes.data || [];
    }

    const permissionsByMember = new Map<string, any[]>();
    for (const row of permissionRows) {
      permissionsByMember.set(row.member_id, [...(permissionsByMember.get(row.member_id) || []), row]);
    }

    setMembers((memberRows || []).map((member: any) => mapMember(member, profilesByUser.get(member.user_id), permissionsByMember.get(member.id) || [])));
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
    setMemberRole("reception");
    setShowMemberForm(false);
    toast.success(memberPassword ? "Usuario cadastrado." : "Usuario cadastrado para primeiro acesso.");
    await loadMembers();
  };

  const updateMember = async (member: ClinicMember, changes: Partial<Pick<ClinicMember, "role" | "active">>) => {
    if (!clinic.id) return;
    const { error } = await db.from("clinic_members").update(changes).eq("id", member.id).eq("clinic_id", clinic.id);
    if (error) return toast.error("Nao foi possivel atualizar o usuario.");
    setMembers((prev) => prev.map((item) => {
      if (item.id !== member.id) return item;
      const nextRole = (changes.role || item.role) as Role;
      return { ...item, ...changes, permissions: nextRole === "admin" ? buildRolePermissions("admin") : item.permissions };
    }));
  };

  const updatePermission = async (member: ClinicMember, module: PermissionModule, action: PermissionAction, checked: boolean) => {
    if (!clinic.id || member.role === "admin") return;
    const currentModule = member.permissions[module] || buildRolePermissions(member.role)[module];
    const nextModule = { ...currentModule, [action]: checked };

    if (action !== "view" && checked) nextModule.view = true;
    if (action === "view" && !checked) {
      nextModule.create = false;
      nextModule.update = false;
      nextModule.delete = false;
    }

    const payload = {
      clinic_id: clinic.id,
      member_id: member.id,
      module,
      can_view: nextModule.view,
      can_create: nextModule.create,
      can_update: nextModule.update,
      can_delete: nextModule.delete,
    };

    const { error } = await db.rpc("set_clinic_member_permission", {
      _clinic_id: payload.clinic_id,
      _member_id: payload.member_id,
      _module: payload.module,
      _can_view: payload.can_view,
      _can_create: payload.can_create,
      _can_update: payload.can_update,
      _can_delete: payload.can_delete,
    });
    if (error) return toast.error(error.message || "Nao foi possivel atualizar a permissao.");

    setMembers((prev) => prev.map((item) => item.id === member.id ? {
      ...item,
      permissions: { ...item.permissions, [module]: nextModule },
    } : item));
  };

  const changeUserPassword = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada.");
    if (!selectedMember?.userId || !newUserPassword || !confirmUserPassword || !adminPassword) return toast.error("Preencha todos os campos da troca de senha.");
    if (newUserPassword !== confirmUserPassword) return toast.error("A confirmacao de senha nao confere.");
    if (newUserPassword.length < 6) return toast.error("A nova senha precisa ter pelo menos 6 caracteres.");

    setChangingPassword(true);
    const { error } = await supabase.functions.invoke("manage-clinic-users", {
      body: {
        action: "change-password",
        clinicId: clinic.id,
        userId: selectedMember.userId,
        newPassword: newUserPassword,
        confirmPassword: confirmUserPassword,
        adminPassword,
      },
    });
    setChangingPassword(false);
    if (error) return toast.error(error.message || "Nao foi possivel alterar a senha.");

    setNewUserPassword("");
    setConfirmUserPassword("");
    setAdminPassword("");
    toast.success("Senha alterada.");
  };

  return (
    <ClinicLayout title="Seguranca" subtitle="Usuarios, acessos e senhas da clinica">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-5 animate-fade-in">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">Usuarios da Clinica</h3>
                  <p className="text-xs text-muted-foreground">Selecione um usuario para ajustar senha e autorizacoes.</p>
                </div>
              </div>
              <Button onClick={() => setShowMemberForm(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Usuario
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Email</th>
                    <th className="text-left text-xs font-medium text-muted-foreground p-3">Cargo/Funcao</th>
                    <th className="text-center text-xs font-medium text-muted-foreground p-3">Status</th>
                    <th className="text-center text-xs font-medium text-muted-foreground p-3">Aprovar</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/40 ${selectedMember?.id === member.id ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedMemberId(member.id)}
                    >
                      <td className="p-3"><p className="text-sm font-medium text-foreground">{member.fullName}</p></td>
                      <td className="p-3"><p className="text-sm text-muted-foreground">{member.email}</p></td>
                      <td className="p-3">
                        <Select value={member.role} onValueChange={(role: Role) => updateMember(member, { role })}>
                          <SelectTrigger className="max-w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(roleLabels).map(([role, label]) => <SelectItem key={role} value={role}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-medium ${member.active ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{member.active ? "Ativo" : "Pendente"}</span></td>
                      <td className="p-3 text-center"><Switch checked={member.active} disabled={member.userId === user?.id} onCheckedChange={(active) => updateMember(member, { active })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="p-5 h-fit xl:sticky xl:top-6">
          {selectedMember ? (
            <Tabs defaultValue="permissions" className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{selectedMember.fullName}</h3>
                  <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
                  <p className="mt-1 text-xs font-medium text-primary">{roleLabels[selectedMember.role]}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${selectedMember.active ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                  {selectedMember.active ? "Ativo" : "Pendente"}
                </span>
              </div>

              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="permissions">Autorizacoes</TabsTrigger>
                <TabsTrigger value="password">Senha</TabsTrigger>
              </TabsList>

              <TabsContent value="permissions" className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold">Autorizacoes do usuario</h4>
                    <p className="text-xs text-muted-foreground">Controle acesso por modulo e acao.</p>
                  </div>
                </div>
                {selectedMember.role === "admin" ? (
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                    Administrador tem acesso total ao sistema.
                  </div>
                ) : null}
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Modulo</th>
                        {permissionActions.map((action) => (
                          <th key={action.key} className="text-center text-xs font-medium text-muted-foreground p-3">{action.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {permissionModules.map((module) => {
                        const modulePermissions = selectedMember.role === "admin" ? fullModulePermissions : selectedMember.permissions[module.key];
                        return (
                          <tr key={module.key} className="border-b border-border/50 last:border-0">
                            <td className="p-3 text-sm font-medium">{module.label}</td>
                            {permissionActions.map((action) => (
                              <td key={action.key} className="p-3 text-center">
                                <Switch
                                  checked={Boolean(modulePermissions?.[action.key])}
                                  disabled={selectedMember.role === "admin"}
                                  onCheckedChange={(checked) => updatePermission(selectedMember, module.key, action.key, checked)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="password" className="space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold">Alterar senha</h4>
                    <p className="text-xs text-muted-foreground">Somente administradores podem alterar senhas.</p>
                  </div>
                </div>
                <div><Label>Usuario</Label><Input value={`${selectedMember.fullName} - ${selectedMember.email}`} disabled /></div>
                <div><Label>Nova senha</Label><Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} /></div>
                <div><Label>Confirmacao de senha</Label><Input type="password" value={confirmUserPassword} onChange={(e) => setConfirmUserPassword(e.target.value)} /></div>
                <div><Label>Senha do administrador</Label><Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></div>
                <Button onClick={changeUserPassword} disabled={changingPassword} className="w-full">{changingPassword ? "Alterando..." : "Alterar Senha"}</Button>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum usuario selecionado.</div>
          )}
        </Card>
      </div>

      <Dialog open={showMemberForm} onOpenChange={setShowMemberForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cadastrar Usuario</DialogTitle>
          </DialogHeader>
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
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setShowMemberForm(false)}>Cancelar</Button>
            <Button onClick={createMember} disabled={savingMember}>{savingMember ? "Cadastrando..." : "Cadastrar Usuario"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </ClinicLayout>
  );
}
