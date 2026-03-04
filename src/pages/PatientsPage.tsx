import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockPatients, mockAppointments, mockClinicalRecords, type Patient } from "@/data/mockData";
import { Search, Plus, Phone, Mail, Eye, Edit2, Trash2, FileText, Calendar, User, Heart, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  attended: "Compareceu",
  cancelled: "Cancelado",
  missed: "Faltou",
};

const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  attended: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  missed: "bg-warning/10 text-warning",
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.cpf.includes(search)
  );

  const selected = patients.find((p) => p.id === selectedPatient);
  const patientAppointments = selected ? mockAppointments.filter(a => a.patientId === selected.id) : [];
  const patientRecords = selected ? mockClinicalRecords.filter(r => r.patientId === selected.id) : [];

  const handleDelete = () => {
    if (deleteId) {
      setPatients(prev => prev.filter(p => p.id !== deleteId));
      toast.success("Paciente excluído com sucesso");
      setDeleteId(null);
    }
  };

  const handleSave = () => {
    toast.success(editingPatient ? "Paciente atualizado com sucesso" : "Paciente cadastrado com sucesso");
    setShowForm(false);
    setEditingPatient(null);
  };

  const openEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setShowForm(true);
  };

  return (
    <ClinicLayout title="Pacientes" subtitle={`${patients.length} cadastrados`}>
      <div className="space-y-5 animate-fade-in">
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { setEditingPatient(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Paciente
          </Button>
        </div>

        {/* Patient List */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">CPF</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Telefone</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Convênio</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Cadastro</th>
                  <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => (
                  <tr key={patient.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="text-sm font-medium text-foreground">{patient.name}</p>
                      {patient.notes && (
                        <p className="text-[10px] text-warning mt-0.5">⚠ {patient.notes}</p>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{patient.cpf}</td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />{patient.phone}
                      </span>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <Badge variant="secondary" className="text-xs font-normal">{patient.insurance}</Badge>
                    </td>
                    <td className="p-3 hidden lg:table-cell text-sm text-muted-foreground">
                      {new Date(patient.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(patient.id)} title="Visualizar">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(patient)} title="Editar">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(patient.id)} title="Excluir" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Patient Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingPatient(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPatient ? "Editar Paciente" : "Cadastrar Paciente"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-2">
              {/* Dados Pessoais */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Dados Pessoais</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Nome completo</Label>
                    <Input placeholder="Nome do paciente" defaultValue={editingPatient?.name} />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input placeholder="000.000.000-00" defaultValue={editingPatient?.cpf} />
                  </div>
                  <div>
                    <Label>Data de nascimento</Label>
                    <Input type="date" defaultValue={editingPatient?.birthDate} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contato */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Contato</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input placeholder="(00) 00000-0000" defaultValue={editingPatient?.phone} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input placeholder="email@exemplo.com" defaultValue={editingPatient?.email} />
                  </div>
                  <div className="col-span-2">
                    <Label>Endereço</Label>
                    <Input placeholder="Rua, número, bairro, cidade/UF" defaultValue={editingPatient?.address} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Informações Clínicas */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Informações Clínicas</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Convênio</Label>
                    <Input placeholder="Particular, Amil, SulAmérica..." defaultValue={editingPatient?.insurance} />
                  </div>
                  <div>
                    <Label>Alergias / Alertas</Label>
                    <Input placeholder="Ex: Alergia a penicilina" defaultValue={editingPatient?.notes} />
                  </div>
                  <div className="col-span-2">
                    <Label>Observações médicas</Label>
                    <Textarea placeholder="Condições de saúde, medicamentos em uso, informações relevantes..." rows={3} defaultValue={editingPatient?.medicalNotes} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingPatient(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editingPatient ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Patient Detail Dialog */}
        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                {selected?.name}
              </DialogTitle>
            </DialogHeader>
            {selected && (
              <Tabs defaultValue="info" className="mt-2">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="info">Dados Pessoais</TabsTrigger>
                  <TabsTrigger value="history">Atendimentos ({patientAppointments.length})</TabsTrigger>
                  <TabsTrigger value="records">Prontuário ({patientRecords.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">CPF</span>
                      <p className="font-medium">{selected.cpf}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Nascimento</span>
                      <p className="font-medium">{new Date(selected.birthDate).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Telefone</span>
                      <p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" />{selected.phone}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Email</span>
                      <p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" />{selected.email}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <span className="text-muted-foreground text-xs">Endereço</span>
                      <p className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{selected.address}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Convênio</span>
                      <Badge variant="secondary">{selected.insurance}</Badge>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Cadastro</span>
                      <p className="font-medium">{new Date(selected.createdAt).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  {selected.notes && (
                    <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm">⚠ {selected.notes}</div>
                  )}
                  {selected.medicalNotes && (
                    <div className="p-3 rounded-lg bg-info/10 text-info text-sm">
                      <p className="font-semibold text-xs mb-1">Observações médicas</p>
                      {selected.medicalNotes}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-2">
                  {patientAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum atendimento registrado</p>
                  ) : (
                    patientAppointments.sort((a, b) => b.date.localeCompare(a.date)).map(apt => (
                      <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{apt.procedure}</p>
                            <p className="text-xs text-muted-foreground">{new Date(apt.date + "T12:00:00").toLocaleDateString("pt-BR")} • {apt.time} • {apt.professionalName}</p>
                          </div>
                        </div>
                        <Badge className={`${statusBadge[apt.status]} border-0`}>{statusLabels[apt.status]}</Badge>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="records" className="mt-4 space-y-3">
                  {patientRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro clínico</p>
                  ) : (
                    patientRecords.sort((a, b) => b.date.localeCompare(a.date)).map(rec => (
                      <Card key={rec.id} className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">{new Date(rec.date).toLocaleDateString("pt-BR")}</span>
                          <span className="text-xs text-muted-foreground">• {rec.professionalName}</span>
                        </div>
                        {rec.complaint && <p className="text-xs text-muted-foreground"><span className="font-semibold">Queixa:</span> {rec.complaint}</p>}
                        {rec.procedurePerformed && <p className="text-xs text-muted-foreground mt-1"><span className="font-semibold">Procedimento:</span> {rec.procedurePerformed}</p>}
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={() => setDeleteId(null)}
          title="Excluir Paciente"
          description="Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita."
          onConfirm={handleDelete}
        />
      </div>
    </ClinicLayout>
  );
}
