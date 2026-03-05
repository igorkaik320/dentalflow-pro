import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  mockPatients, mockProcedures, mockSuppliers, mockFinancialCategories, mockAppointments, mockClinicalRecords,
  type Patient, type Procedure, type Supplier, type FinancialCategory,
} from "@/data/mockData";
import {
  Plus, Edit2, Trash2, Search, Phone, Mail, Eye, User, Heart, MapPin,
  Clock, DollarSign, Stethoscope, Building, Tag, FileText, Calendar,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado", attended: "Compareceu", cancelled: "Cancelado", missed: "Faltou",
};
const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary", attended: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive", missed: "bg-warning/10 text-warning",
};

export default function RegistrationsPage() {
  // Patients state
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [deletePatientId, setDeletePatientId] = useState<string | null>(null);

  // Procedures state
  const [procedures, setProcedures] = useState<Procedure[]>(mockProcedures);
  const [showProcForm, setShowProcForm] = useState(false);
  const [editingProc, setEditingProc] = useState<Procedure | null>(null);
  const [deleteProcId, setDeleteProcId] = useState<string | null>(null);

  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null);

  // Categories state
  const [categories, setCategories] = useState<FinancialCategory[]>(mockFinancialCategories);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<FinancialCategory | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  // Patient helpers
  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.cpf.includes(patientSearch)
  );
  const selected = patients.find(p => p.id === selectedPatient);
  const patientAppointments = selected ? mockAppointments.filter(a => a.patientId === selected.id) : [];
  const patientRecords = selected ? mockClinicalRecords.filter(r => r.patientId === selected.id) : [];

  return (
    <ClinicLayout title="Cadastros" subtitle="Gerenciar cadastros do sistema">
      <div className="space-y-5 animate-fade-in">
        <Tabs defaultValue="patients">
          <TabsList className="flex-wrap">
            <TabsTrigger value="patients" className="gap-1.5"><User className="h-3.5 w-3.5" />Pacientes</TabsTrigger>
            <TabsTrigger value="procedures" className="gap-1.5"><Stethoscope className="h-3.5 w-3.5" />Procedimentos</TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5"><Building className="h-3.5 w-3.5" />Fornecedores</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5"><Tag className="h-3.5 w-3.5" />Categorias</TabsTrigger>
          </TabsList>

          {/* ═══════ PACIENTES ═══════ */}
          <TabsContent value="patients">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nome ou CPF..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className="pl-9" />
                </div>
                <Button onClick={() => { setEditingPatient(null); setShowPatientForm(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" />Novo Paciente
                </Button>
              </div>
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
                      {filteredPatients.map(patient => (
                        <tr key={patient.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <p className="text-sm font-medium text-foreground">{patient.name}</p>
                            {patient.notes && <p className="text-[10px] text-warning mt-0.5">⚠ {patient.notes}</p>}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{patient.cpf}</td>
                          <td className="p-3 hidden md:table-cell">
                            <span className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>
                          </td>
                          <td className="p-3 hidden lg:table-cell"><Badge variant="secondary" className="text-xs font-normal">{patient.insurance}</Badge></td>
                          <td className="p-3 hidden lg:table-cell text-sm text-muted-foreground">{new Date(patient.createdAt).toLocaleDateString("pt-BR")}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(patient.id)} title="Visualizar"><Eye className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => { setEditingPatient(patient); setShowPatientForm(true); }} title="Editar"><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeletePatientId(patient.id)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════ PROCEDIMENTOS ═══════ */}
          <TabsContent value="procedures">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{procedures.length} procedimentos cadastrados</p>
                <Button onClick={() => { setEditingProc(null); setShowProcForm(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" />Novo Procedimento
                </Button>
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Procedimento</th>
                        <th className="text-right text-xs font-medium text-muted-foreground p-3">Valor Padrão</th>
                        <th className="text-center text-xs font-medium text-muted-foreground p-3">Duração (min)</th>
                        <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procedures.map(proc => (
                        <tr key={proc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Stethoscope className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <span className="text-sm font-medium text-foreground">{proc.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-sm font-semibold text-foreground text-right">
                            <span className="flex items-center justify-end gap-1"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />R$ {proc.defaultPrice.toFixed(2)}</span>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground text-center">
                            <span className="flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5" />{proc.averageDuration}</span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingProc(proc); setShowProcForm(true); }}><Edit2 className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteProcId(proc.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════ FORNECEDORES ═══════ */}
          <TabsContent value="suppliers">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{suppliers.length} fornecedores cadastrados</p>
                <Button onClick={() => { setEditingSupplier(null); setShowSupplierForm(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" />Novo Fornecedor
                </Button>
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Fornecedor</th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">CNPJ</th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Contato</th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Categoria</th>
                        <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map(sup => (
                        <tr key={sup.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Building className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{sup.name}</p>
                                {sup.notes && <p className="text-[10px] text-muted-foreground">{sup.notes}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{sup.cnpj}</td>
                          <td className="p-3 hidden md:table-cell">
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{sup.phone}</p>
                          </td>
                          <td className="p-3"><Badge variant="secondary" className="text-xs font-normal">{sup.category}</Badge></td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingSupplier(sup); setShowSupplierForm(true); }}><Edit2 className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteSupplierId(sup.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════ CATEGORIAS ═══════ */}
          <TabsContent value="categories">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{categories.length} categorias cadastradas</p>
                <Button onClick={() => { setEditingCat(null); setShowCatForm(true); }}>
                  <Plus className="h-4 w-4 mr-1.5" />Nova Categoria
                </Button>
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th>
                        <th className="text-left text-xs font-medium text-muted-foreground p-3">Tipo</th>
                        <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(cat => (
                        <tr key={cat.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cat.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                                <Tag className={`h-3.5 w-3.5 ${cat.type === 'income' ? 'text-success' : 'text-destructive'}`} />
                              </div>
                              <span className="text-sm font-medium text-foreground">{cat.name}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary" className="text-xs font-normal">
                              {cat.type === 'income' ? 'Receita' : 'Despesa'}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingCat(cat); setShowCatForm(true); }}><Edit2 className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteCatId(cat.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* ═══════ DIALOGS ═══════ */}

        {/* Patient Form */}
        <Dialog open={showPatientForm} onOpenChange={open => { setShowPatientForm(open); if (!open) setEditingPatient(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingPatient ? "Editar Paciente" : "Cadastrar Paciente"}</DialogTitle></DialogHeader>
            <div className="space-y-6 mt-2">
              <div>
                <div className="flex items-center gap-2 mb-3"><User className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Dados Pessoais</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Nome completo</Label><Input placeholder="Nome do paciente" defaultValue={editingPatient?.name} /></div>
                  <div><Label>CPF</Label><Input placeholder="000.000.000-00" defaultValue={editingPatient?.cpf} /></div>
                  <div><Label>Data de nascimento</Label><Input type="date" defaultValue={editingPatient?.birthDate} /></div>
                </div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3"><Phone className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Contato</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefone</Label><Input placeholder="(00) 00000-0000" defaultValue={editingPatient?.phone} /></div>
                  <div><Label>Email</Label><Input placeholder="email@exemplo.com" defaultValue={editingPatient?.email} /></div>
                  <div className="col-span-2"><Label>Endereço</Label><Input placeholder="Rua, número, bairro, cidade/UF" defaultValue={editingPatient?.address} /></div>
                </div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3"><Heart className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Informações Clínicas</h3></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Convênio</Label><Input placeholder="Particular, Amil..." defaultValue={editingPatient?.insurance} /></div>
                  <div><Label>Alergias / Alertas</Label><Input placeholder="Ex: Alergia a penicilina" defaultValue={editingPatient?.notes} /></div>
                  <div className="col-span-2"><Label>Observações médicas</Label><Textarea placeholder="Condições de saúde, medicamentos..." rows={3} defaultValue={editingPatient?.medicalNotes} /></div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => { setShowPatientForm(false); setEditingPatient(null); }}>Cancelar</Button>
              <Button onClick={() => { toast.success(editingPatient ? "Paciente atualizado" : "Paciente cadastrado"); setShowPatientForm(false); setEditingPatient(null); }}>{editingPatient ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Patient Detail */}
        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div>
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
                    <div className="space-y-1"><span className="text-muted-foreground text-xs">CPF</span><p className="font-medium">{selected.cpf}</p></div>
                    <div className="space-y-1"><span className="text-muted-foreground text-xs">Nascimento</span><p className="font-medium">{new Date(selected.birthDate).toLocaleDateString("pt-BR")}</p></div>
                    <div className="space-y-1"><span className="text-muted-foreground text-xs">Telefone</span><p className="font-medium flex items-center gap-1"><Phone className="h-3 w-3" />{selected.phone}</p></div>
                    <div className="space-y-1"><span className="text-muted-foreground text-xs">Email</span><p className="font-medium flex items-center gap-1"><Mail className="h-3 w-3" />{selected.email}</p></div>
                    <div className="space-y-1 col-span-2"><span className="text-muted-foreground text-xs">Endereço</span><p className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{selected.address}</p></div>
                    <div className="space-y-1"><span className="text-muted-foreground text-xs">Convênio</span><Badge variant="secondary">{selected.insurance}</Badge></div>
                    <div className="space-y-1"><span className="text-muted-foreground text-xs">Cadastro</span><p className="font-medium">{new Date(selected.createdAt).toLocaleDateString("pt-BR")}</p></div>
                  </div>
                  {selected.notes && <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm">⚠ {selected.notes}</div>}
                  {selected.medicalNotes && <div className="p-3 rounded-lg bg-primary/5 text-sm"><p className="font-semibold text-xs mb-1 text-muted-foreground">Observações médicas</p>{selected.medicalNotes}</div>}
                </TabsContent>
                <TabsContent value="history" className="mt-4 space-y-2">
                  {patientAppointments.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum atendimento registrado</p> :
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
                    ))}
                </TabsContent>
                <TabsContent value="records" className="mt-4 space-y-3">
                  {patientRecords.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro clínico</p> :
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
                    ))}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Procedure Form */}
        <Dialog open={showProcForm} onOpenChange={open => { setShowProcForm(open); if (!open) setEditingProc(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingProc ? "Editar Procedimento" : "Novo Procedimento"}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label>Nome do procedimento</Label><Input placeholder="Ex: Clareamento Dental" defaultValue={editingProc?.name} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor padrão (R$)</Label><Input type="number" placeholder="0,00" defaultValue={editingProc?.defaultPrice} /></div>
                <div><Label>Duração média (min)</Label><Input type="number" placeholder="30" defaultValue={editingProc?.averageDuration} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowProcForm(false); setEditingProc(null); }}>Cancelar</Button>
              <Button onClick={() => { toast.success(editingProc ? "Procedimento atualizado" : "Procedimento cadastrado"); setShowProcForm(false); setEditingProc(null); }}>{editingProc ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Supplier Form */}
        <Dialog open={showSupplierForm} onOpenChange={open => { setShowSupplierForm(open); if (!open) setEditingSupplier(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label>Nome / Razão Social</Label><Input placeholder="Nome do fornecedor" defaultValue={editingSupplier?.name} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CNPJ</Label><Input placeholder="00.000.000/0001-00" defaultValue={editingSupplier?.cnpj} /></div>
                <div><Label>Categoria</Label><Input placeholder="Material, Laboratório..." defaultValue={editingSupplier?.category} /></div>
                <div><Label>Telefone</Label><Input placeholder="(00) 0000-0000" defaultValue={editingSupplier?.phone} /></div>
                <div><Label>Email</Label><Input placeholder="email@fornecedor.com" defaultValue={editingSupplier?.email} /></div>
              </div>
              <div><Label>Observações</Label><Textarea placeholder="Informações adicionais..." rows={2} defaultValue={editingSupplier?.notes} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowSupplierForm(false); setEditingSupplier(null); }}>Cancelar</Button>
              <Button onClick={() => { toast.success(editingSupplier ? "Fornecedor atualizado" : "Fornecedor cadastrado"); setShowSupplierForm(false); setEditingSupplier(null); }}>{editingSupplier ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Form */}
        <Dialog open={showCatForm} onOpenChange={open => { setShowCatForm(open); if (!open) setEditingCat(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div><Label>Nome da categoria</Label><Input placeholder="Ex: Material" defaultValue={editingCat?.name} /></div>
              <div>
                <Label>Tipo</Label>
                <Select defaultValue={editingCat?.type || 'expense'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowCatForm(false); setEditingCat(null); }}>Cancelar</Button>
              <Button onClick={() => { toast.success(editingCat ? "Categoria atualizada" : "Categoria cadastrada"); setShowCatForm(false); setEditingCat(null); }}>{editingCat ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirm Dialogs */}
        <ConfirmDialog open={!!deletePatientId} onOpenChange={() => setDeletePatientId(null)} title="Excluir Paciente" description="Tem certeza que deseja excluir este paciente?" onConfirm={() => { setPatients(prev => prev.filter(p => p.id !== deletePatientId)); toast.success("Paciente excluído"); setDeletePatientId(null); }} />
        <ConfirmDialog open={!!deleteProcId} onOpenChange={() => setDeleteProcId(null)} title="Excluir Procedimento" description="Tem certeza que deseja excluir este procedimento?" onConfirm={() => { setProcedures(prev => prev.filter(p => p.id !== deleteProcId)); toast.success("Procedimento excluído"); setDeleteProcId(null); }} />
        <ConfirmDialog open={!!deleteSupplierId} onOpenChange={() => setDeleteSupplierId(null)} title="Excluir Fornecedor" description="Tem certeza que deseja excluir este fornecedor?" onConfirm={() => { setSuppliers(prev => prev.filter(s => s.id !== deleteSupplierId)); toast.success("Fornecedor excluído"); setDeleteSupplierId(null); }} />
        <ConfirmDialog open={!!deleteCatId} onOpenChange={() => setDeleteCatId(null)} title="Excluir Categoria" description="Tem certeza que deseja excluir esta categoria?" onConfirm={() => { setCategories(prev => prev.filter(c => c.id !== deleteCatId)); toast.success("Categoria excluída"); setDeleteCatId(null); }} />
      </div>
    </ClinicLayout>
  );
}
