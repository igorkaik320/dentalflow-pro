import { useState, useRef } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockProfessionals } from "@/data/mockData";
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

export default function SettingsPage() {
  const [showProfForm, setShowProfForm] = useState(false);
  const { clinic, setClinic } = useClinic();
  const [clinicName, setClinicName] = useState(clinic.name);
  const [clinicCnpj, setClinicCnpj] = useState("12.345.678/0001-90");
  const [clinicPhone, setClinicPhone] = useState("(11) 3456-7890");
  const [clinicEmail, setClinicEmail] = useState("contato@odontosaas.com");
  const [clinicAddress, setClinicAddress] = useState("Av. Paulista, 1000, Sala 501 - São Paulo/SP");
  const [logoPreview, setLogoPreview] = useState<string | null>(clinic.logoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const handleSaveClinic = () => {
    setClinic({ name: clinicName, logoUrl: logoPreview });
    toast.success("Dados da clínica salvos com sucesso! As alterações já estão visíveis no menu lateral.");
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
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-7 w-7 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">Dados da Clínica</h3>
                  <p className="text-xs text-muted-foreground">Informações exibidas nos documentos e no sistema</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Logo
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Nome da Clínica</Label>
                  <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CNPJ</Label>
                    <Input value={clinicCnpj} onChange={(e) => setClinicCnpj(e.target.value)} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Textarea value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} rows={2} />
                </div>
                <Button onClick={handleSaveClinic} className="w-full">Salvar Alterações</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="professionals">
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold">Profissionais Cadastrados</h3>
                <Dialog open={showProfForm} onOpenChange={setShowProfForm}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Novo Profissional</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="col-span-2"><Label>Nome</Label><Input placeholder="Nome completo" /></div>
                      <div><Label>Especialidade</Label><Input placeholder="Ortodontia" /></div>
                      <div><Label>Comissão (%)</Label><Input type="number" placeholder="40" /></div>
                      <div><Label>Telefone</Label><Input placeholder="(00) 00000-0000" /></div>
                      <div><Label>Email</Label><Input placeholder="email@clinica.com" /></div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setShowProfForm(false)}>Cancelar</Button>
                      <Button onClick={() => { setShowProfForm(false); toast.success("Profissional cadastrado com sucesso"); }}>Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Especialidade</th>
                      <th className="text-center text-xs font-medium text-muted-foreground p-3">Comissão</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Contato</th>
                      <th className="text-center text-xs font-medium text-muted-foreground p-3">Ativo</th>
                      <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockProfessionals.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 text-sm font-medium text-foreground">{p.name}</td>
                        <td className="p-3 text-sm text-muted-foreground">{p.specialty}</td>
                        <td className="p-3 text-sm text-center font-semibold text-primary">{p.commissionRate}%</td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{p.phone}</td>
                        <td className="p-3 text-center">
                          <Switch checked={p.active} />
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm"><Edit2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card className="p-5 max-w-md">
              <h3 className="text-sm font-semibold mb-4">Categorias Financeiras</h3>
              <div className="space-y-2">
                {["Material", "Fixo", "Utilidades", "Laboratório", "Marketing", "Outros"].map((cat) => (
                  <div key={cat} className="flex items-center justify-between p-2.5 rounded bg-secondary/50">
                    <span className="text-sm text-foreground">{cat}</span>
                    <Button variant="ghost" size="sm"><Edit2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Categoria
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="p-5 max-w-md">
              <h3 className="text-sm font-semibold mb-4">Horários de Atendimento</h3>
              <div className="space-y-3">
                {[
                  { day: "Segunda a Sexta", start: "08:00", end: "18:00" },
                  { day: "Sábado", start: "08:00", end: "12:00" },
                  { day: "Domingo", start: "", end: "" },
                ].map((schedule) => (
                  <div key={schedule.day} className="flex items-center justify-between p-3 rounded bg-secondary/50">
                    <span className="text-sm font-medium text-foreground">{schedule.day}</span>
                    {schedule.start ? (
                      <span className="text-sm text-muted-foreground">{schedule.start} - {schedule.end}</span>
                    ) : (
                      <span className="text-xs text-destructive">Fechado</span>
                    )}
                  </div>
                ))}
              </div>
              <Button className="mt-4" onClick={() => toast.success("Horários salvos com sucesso")}>Salvar Horários</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClinicLayout>
  );
}
