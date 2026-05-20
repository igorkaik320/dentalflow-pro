import { useEffect, useRef, useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Building2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { db, uploadClinicLogo } from "@/lib/clinicCloud";
import { formatCNPJ } from "@/lib/utils";

type Professional = {
  id: string;
  name: string;
  specialty: string;
  commissionRate: number;
  phone: string;
  email: string;
  active: boolean;
};

type ProfessionalForm = Omit<Professional, "id" | "active"> & { active: boolean };

const emptyProfessional: ProfessionalForm = {
  name: "",
  specialty: "",
  commissionRate: 0,
  phone: "",
  email: "",
  active: true,
};

function mapProfessional(row: any): Professional {
  return {
    id: row.id,
    name: row.name || "",
    specialty: row.specialty || "",
    commissionRate: Number(row.commission_rate || 0),
    phone: row.phone || "",
    email: row.email || "",
    active: Boolean(row.active),
  };
}

export default function SettingsPage() {
  const [showProfForm, setShowProfForm] = useState(false);
  const { clinic, user, setClinic, refreshClinic } = useClinic();
  const [clinicName, setClinicName] = useState(clinic.name);
  const [clinicCnpj, setClinicCnpj] = useState(formatCNPJ(clinic.cnpj));
  const [clinicPhone, setClinicPhone] = useState(clinic.phone);
  const [clinicEmail, setClinicEmail] = useState(clinic.email);
  const [clinicAddress, setClinicAddress] = useState(clinic.address);
  const [logoPreview, setLogoPreview] = useState<string | null>(clinic.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalForm, setProfessionalForm] = useState<ProfessionalForm>(emptyProfessional);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingProfessional, setSavingProfessional] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClinicName(clinic.name);
    setClinicCnpj(formatCNPJ(clinic.cnpj));
    setClinicPhone(clinic.phone);
    setClinicEmail(clinic.email);
    setClinicAddress(clinic.address);
    setLogoPreview(clinic.logoUrl);
  }, [clinic]);

  useEffect(() => {
    if (!clinic.id) return;
    void loadProfessionals();
  }, [clinic.id]);

  const loadProfessionals = async () => {
    if (!clinic.id) return;
    const { data, error } = await db.from("professionals").select("*").eq("clinic_id", clinic.id).order("name");
    if (error) return toast.error("Não foi possível carregar profissionais.");
    setProfessionals((data || []).map(mapProfessional));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveClinic = async () => {
    if (!clinic.id) return toast.error("Clínica não vinculada.");
    setSavingClinic(true);
    let logoUrl = logoPreview;
    try {
      if (logoFile && user?.id) logoUrl = await uploadClinicLogo(user.id, logoFile);
      const { error } = await db.from("clinics").update({
        name: clinicName,
        cnpj: clinicCnpj,
        phone: clinicPhone,
        email: clinicEmail,
        address: clinicAddress,
        logo_url: logoUrl,
      }).eq("id", clinic.id);
      setSavingClinic(false);
      if (error) return toast.error("Não foi possível salvar os dados da clínica.");
      setClinic({ name: clinicName, cnpj: clinicCnpj, phone: clinicPhone, email: clinicEmail, address: clinicAddress, logoUrl });
      setLogoFile(null);
      await refreshClinic();
      toast.success("Dados da clínica salvos atualizados.");
    } catch {
      setSavingClinic(false);
      toast.error("Não foi possível enviar a logo.");
    }
  };

  const openProfessional = (professional?: Professional) => {
    setEditingProfessional(professional || null);
    setProfessionalForm(professional ? {
      name: professional.name,
      specialty: professional.specialty,
      commissionRate: professional.commissionRate,
      phone: professional.phone,
      email: professional.email,
      active: professional.active,
    } : emptyProfessional);
    setShowProfForm(true);
  };

  const saveProfessional = async () => {
    if (!clinic.id) return toast.error("Clínica não vinculada.");
    if (!professionalForm.name.trim()) return toast.error("Informe o nome do profissional.");
    setSavingProfessional(true);
    const payload = {
      clinic_id: clinic.id,
      name: professionalForm.name.trim(),
      specialty: professionalForm.specialty,
      commission_rate: Number(professionalForm.commissionRate || 0),
      phone: professionalForm.phone,
      email: professionalForm.email,
      active: professionalForm.active,
    };
    const query = editingProfessional
      ? db.from("professionals").update(payload).eq("id", editingProfessional.id).eq("clinic_id", clinic.id).select().single()
      : db.from("professionals").insert(payload).select().single();
    const { data, error } = await query;
    setSavingProfessional(false);
    if (error) return toast.error("Não foi possível salvar o profissional.");
    const saved = mapProfessional(data);
    setProfessionals((prev) => editingProfessional
      ? prev.map((professional) => professional.id === saved.id ? saved : professional)
      : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    );
    setShowProfForm(false);
    setEditingProfessional(null);
    toast.success(editingProfessional ? "Profissional atualizado" : "Profissional cadastrado");
  };

  const toggleProfessional = async (professional: Professional, active: boolean) => {
    if (!clinic.id) return;
    const { error } = await db.from("professionals").update({ active }).eq("id", professional.id).eq("clinic_id", clinic.id);
    if (error) return toast.error("Não foi possível alterar o status.");
    setProfessionals((prev) => prev.map((item) => item.id === professional.id ? { ...item, active } : item));
  };

  return (
    <ClinicLayout title="Configurações" subtitle="Gerenciar sistema">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="clinic">
          <TabsList>
            <TabsTrigger value="clinic">Dados da Clínica</TabsTrigger>
            <TabsTrigger value="professionals">Profissionais</TabsTrigger>
            <TabsTrigger value="schedule">Horários</TabsTrigger>
          </TabsList>

          <TabsContent value="clinic">
            <Card className="p-6 max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => fileRef.current?.click()}>
                  {logoPreview ? <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7 text-primary" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Dados da Clínica</h3>
                  <p className="text-xs text-muted-foreground">Informações salvas em clinics atualizados</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Logo</Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
              <div className="space-y-4">
                <div><Label>Nome da Clínica</Label><Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>CNPJ</Label><Input inputMode="numeric" value={clinicCnpj} onChange={(e) => setClinicCnpj(formatCNPJ(e.target.value))} /></div>
                  <div><Label>Telefone</Label><Input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} /></div>
                </div>
                <div><Label>Email</Label><Input value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} /></div>
                <div><Label>Endereço</Label><Textarea value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} rows={2} /></div>
                <Button onClick={handleSaveClinic} className="w-full" disabled={savingClinic}>{savingClinic ? "Salvando..." : "Salvar Alterações"}</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="professionals">
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold">Profissionais Cadastrados</h3>
                <Dialog open={showProfForm} onOpenChange={setShowProfForm}>
                  <DialogTrigger asChild><Button size="sm" onClick={() => openProfessional()}><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingProfessional ? "Editar Profissional" : "Novo Profissional"}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="col-span-2"><Label>Nome</Label><Input value={professionalForm.name} onChange={(e) => setProfessionalForm({ ...professionalForm, name: e.target.value })} /></div>
                      <div><Label>Especialidade</Label><Input value={professionalForm.specialty} onChange={(e) => setProfessionalForm({ ...professionalForm, specialty: e.target.value })} /></div>
                      <div><Label>Comissão (%)</Label><Input type="number" value={professionalForm.commissionRate} onChange={(e) => setProfessionalForm({ ...professionalForm, commissionRate: Number(e.target.value) })} /></div>
                      <div><Label>Telefone</Label><Input value={professionalForm.phone} onChange={(e) => setProfessionalForm({ ...professionalForm, phone: e.target.value })} /></div>
                      <div><Label>Email</Label><Input value={professionalForm.email} onChange={(e) => setProfessionalForm({ ...professionalForm, email: e.target.value })} /></div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setShowProfForm(false)}>Cancelar</Button>
                      <Button onClick={saveProfessional} disabled={savingProfessional}>{savingProfessional ? "Salvando..." : "Salvar"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Especialidade</th><th className="text-center text-xs font-medium text-muted-foreground p-3">Comissão</th><th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Contato</th><th className="text-center text-xs font-medium text-muted-foreground p-3">Ativo</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th></tr></thead>
                  <tbody>{professionals.map((p) => <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3 text-sm font-medium text-foreground">{p.name}</td><td className="p-3 text-sm text-muted-foreground">{p.specialty}</td><td className="p-3 text-sm text-center font-semibold text-primary">{p.commissionRate}%</td><td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{p.phone}</td><td className="p-3 text-center"><Switch checked={p.active} onCheckedChange={(active) => toggleProfessional(p, active)} /></td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => openProfessional(p)}><Edit2 className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="p-5 max-w-md">
              <h3 className="text-sm font-semibold mb-4">Horários de Atendimento</h3>
              <p className="text-sm text-muted-foreground">Horários ainda não possuem tabela própria. O restante dos dados críticos desta tela já está atualizados.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClinicLayout>
  );
}

