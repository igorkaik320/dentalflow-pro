import { useEffect, useMemo, useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import type { FinancialCategory, Patient, Procedure, Supplier } from "@/data/mockData";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Search, Phone, Mail, Eye, User, Heart, MapPin,
  Clock, DollarSign, Stethoscope, Building, Tag, FileText, Calendar,
} from "lucide-react";

type PatientForm = Omit<Patient, "id" | "createdAt">;
type ProcedureForm = Omit<Procedure, "id">;
type SupplierForm = Omit<Supplier, "id">;
type CategoryForm = Omit<FinancialCategory, "id">;

type PatientHistoryRow = {
  id: string;
  procedure_name: string;
  appointment_date: string;
  appointment_time: string;
  professional_name: string;
  status: string;
};

const emptyPatient: PatientForm = { name: "", cpf: "", birthDate: "", phone: "", email: "", address: "", notes: "", medicalNotes: "", insurance: "Particular" };
const emptyProcedure: ProcedureForm = { name: "", defaultPrice: 0, averageDuration: 30 };
const emptySupplier: SupplierForm = { name: "", cnpj: "", phone: "", email: "", category: "", notes: "" };
const emptyCategory: CategoryForm = { name: "", type: "expense" };

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado", attended: "Compareceu", cancelled: "Cancelado", missed: "Faltou",
};
const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary", attended: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive", missed: "bg-warning/10 text-warning",
};

function mapPatient(row: any): Patient {
  return {
    id: row.id,
    name: row.name || "",
    cpf: row.cpf || "",
    birthDate: row.birth_date || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    notes: row.notes || "",
    medicalNotes: row.medical_notes || "",
    insurance: row.insurance || "Particular",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapProcedure(row: any): Procedure {
  return { id: row.id, name: row.name || "", defaultPrice: Number(row.default_price || 0), averageDuration: Number(row.average_duration || 30) };
}

function mapSupplier(row: any): Supplier {
  return { id: row.id, name: row.name || "", cnpj: row.cnpj || "", phone: row.phone || "", email: row.email || "", category: row.category || "", notes: row.notes || "" };
}

function mapCategory(row: any): FinancialCategory {
  return { id: row.id, name: row.name || "", type: row.type || "expense" };
}

export default function RegistrationsPage() {
  const { clinic } = useClinic();
  const [loading, setLoading] = useState(true);
  const [patientSearch, setPatientSearch] = useState("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [patientHistory, setPatientHistory] = useState<PatientHistoryRow[]>([]);

  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [patientForm, setPatientForm] = useState<PatientForm>(emptyPatient);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [deletePatientId, setDeletePatientId] = useState<string | null>(null);

  const [showProcForm, setShowProcForm] = useState(false);
  const [editingProc, setEditingProc] = useState<Procedure | null>(null);
  const [procForm, setProcForm] = useState<ProcedureForm>(emptyProcedure);
  const [deleteProcId, setDeleteProcId] = useState<string | null>(null);

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier);
  const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null);

  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<FinancialCategory | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategory);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  const selected = patients.find(p => p.id === selectedPatient);
  const filteredPatients = useMemo(() => patients.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.cpf.includes(patientSearch)
  ), [patients, patientSearch]);

  useEffect(() => {
    if (!clinic.id) return;
    void loadData();
  }, [clinic.id]);

  useEffect(() => {
    if (!clinic.id || !selectedPatient) return;
    db.from("appointments")
      .select("id, procedure_name, appointment_date, appointment_time, professional_name, status")
      .eq("clinic_id", clinic.id)
      .eq("patient_id", selectedPatient)
      .order("appointment_date", { ascending: false })
      .then(({ data, error }: any) => {
        if (error) toast.error("Não foi possível carregar o histórico do paciente.");
        else setPatientHistory(data || []);
      });
  }, [clinic.id, selectedPatient]);

  const loadData = async () => {
    if (!clinic.id) return;
    setLoading(true);
    const [patientRes, procRes, supplierRes, catRes] = await Promise.all([
      db.from("patients").select("*").eq("clinic_id", clinic.id).order("created_at", { ascending: false }),
      db.from("procedures").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("suppliers").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("financial_categories").select("*").eq("clinic_id", clinic.id).order("type").order("name"),
    ]);

    setLoading(false);
    const error = patientRes.error || procRes.error || supplierRes.error || catRes.error;
    if (error) {
      toast.error("Não foi possível carregar os cadastros.");
      return;
    }

    setPatients((patientRes.data || []).map(mapPatient));
    setProcedures((procRes.data || []).map(mapProcedure));
    setSuppliers((supplierRes.data || []).map(mapSupplier));
    setCategories((catRes.data || []).map(mapCategory));
  };

  const openPatient = (patient?: Patient) => {
    setEditingPatient(patient || null);
    setPatientForm(patient ? { name: patient.name, cpf: patient.cpf, birthDate: patient.birthDate, phone: patient.phone, email: patient.email, address: patient.address, notes: patient.notes, medicalNotes: patient.medicalNotes, insurance: patient.insurance } : emptyPatient);
    setShowPatientForm(true);
  };

  const savePatient = async () => {
    if (!clinic.id || !patientForm.name.trim()) return toast.error("Informe o nome do paciente.");
    const payload = {
      clinic_id: clinic.id,
      name: patientForm.name.trim(),
      cpf: patientForm.cpf,
      birth_date: patientForm.birthDate || null,
      phone: patientForm.phone,
      email: patientForm.email,
      address: patientForm.address,
      notes: patientForm.notes,
      medical_notes: patientForm.medicalNotes,
      insurance: patientForm.insurance,
    };
    const query = editingPatient
      ? db.from("patients").update(payload).eq("id", editingPatient.id).eq("clinic_id", clinic.id).select().single()
      : db.from("patients").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Não foi possível salvar o paciente.");
    const saved = mapPatient(data);
    setPatients(prev => editingPatient ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]);
    toast.success(editingPatient ? "Paciente atualizado" : "Paciente cadastrado");
    setShowPatientForm(false);
    setEditingPatient(null);
  };

  const saveProcedure = async () => {
    if (!clinic.id || !procForm.name.trim()) return toast.error("Informe o nome do procedimento.");
    const payload = { clinic_id: clinic.id, name: procForm.name.trim(), default_price: Number(procForm.defaultPrice || 0), average_duration: Number(procForm.averageDuration || 30), active: true };
    const query = editingProc
      ? db.from("procedures").update(payload).eq("id", editingProc.id).eq("clinic_id", clinic.id).select().single()
      : db.from("procedures").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Não foi possível salvar o procedimento.");
    const saved = mapProcedure(data);
    setProcedures(prev => editingProc ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(editingProc ? "Procedimento atualizado" : "Procedimento cadastrado");
    setShowProcForm(false);
    setEditingProc(null);
  };

  const saveSupplier = async () => {
    if (!clinic.id || !supplierForm.name.trim()) return toast.error("Informe o nome do fornecedor.");
    const payload = { clinic_id: clinic.id, name: supplierForm.name.trim(), cnpj: supplierForm.cnpj, phone: supplierForm.phone, email: supplierForm.email, category: supplierForm.category, notes: supplierForm.notes };
    const query = editingSupplier
      ? db.from("suppliers").update(payload).eq("id", editingSupplier.id).eq("clinic_id", clinic.id).select().single()
      : db.from("suppliers").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Não foi possível salvar o fornecedor.");
    const saved = mapSupplier(data);
    setSuppliers(prev => editingSupplier ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(editingSupplier ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    setShowSupplierForm(false);
    setEditingSupplier(null);
  };

  const saveCategory = async () => {
    if (!clinic.id || !catForm.name.trim()) return toast.error("Informe o nome da categoria.");
    const payload = { clinic_id: clinic.id, name: catForm.name.trim(), type: catForm.type };
    const query = editingCat
      ? db.from("financial_categories").update(payload).eq("id", editingCat.id).eq("clinic_id", clinic.id).select().single()
      : db.from("financial_categories").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Não foi possível salvar a categoria.");
    const saved = mapCategory(data);
    setCategories(prev => editingCat ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(editingCat ? "Categoria atualizada" : "Categoria cadastrada");
    setShowCatForm(false);
    setEditingCat(null);
  };

  const removeRecord = async (table: string, id: string, onSuccess: () => void, label: string) => {
    if (!clinic.id) return;
    const { error } = await db.from(table).delete().eq("id", id).eq("clinic_id", clinic.id);
    if (error) return toast.error(`Não foi possível excluir ${label}.`);
    onSuccess();
    toast.success(`${label} excluído com sucesso`);
  };

  return (
    <ClinicLayout title="Cadastros" subtitle="Pacientes, procedimentos, fornecedores e categorias integrados ao backend">
      <div className="space-y-5 animate-fade-in">
        <Tabs defaultValue="patients">
          <TabsList className="flex-wrap">
            <TabsTrigger value="patients" className="gap-1.5"><User className="h-3.5 w-3.5" />Pacientes</TabsTrigger>
            <TabsTrigger value="procedures" className="gap-1.5"><Stethoscope className="h-3.5 w-3.5" />Procedimentos</TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5"><Building className="h-3.5 w-3.5" />Fornecedores</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5"><Tag className="h-3.5 w-3.5" />Categorias</TabsTrigger>
          </TabsList>

          <TabsContent value="patients">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nome ou CPF..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} className="pl-9" /></div>
                <Button onClick={() => openPatient()}><Plus className="h-4 w-4 mr-1.5" />Novo Paciente</Button>
              </div>
              <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
                <thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th><th className="text-left text-xs font-medium text-muted-foreground p-3">CPF</th><th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Telefone</th><th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Convênio</th><th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Cadastro</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th></tr></thead>
                <tbody>{loading ? <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Carregando cadastros...</td></tr> : filteredPatients.map(patient => (
                  <tr key={patient.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors"><td className="p-3"><p className="text-sm font-medium text-foreground">{patient.name}</p>{patient.notes && <p className="text-[10px] text-warning mt-0.5">⚠ {patient.notes}</p>}</td><td className="p-3 text-sm text-muted-foreground">{patient.cpf}</td><td className="p-3 hidden md:table-cell"><span className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span></td><td className="p-3 hidden lg:table-cell"><Badge variant="secondary" className="text-xs font-normal">{patient.insurance}</Badge></td><td className="p-3 hidden lg:table-cell text-sm text-muted-foreground">{new Date(patient.createdAt).toLocaleDateString("pt-BR")}</td><td className="p-3 text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setSelectedPatient(patient.id)} title="Visualizar"><Eye className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" onClick={() => openPatient(patient)} title="Editar"><Edit2 className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="sm" onClick={() => setDeletePatientId(patient.id)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></div></td></tr>
                ))}{!loading && filteredPatients.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</td></tr>}</tbody>
              </table></div></Card>
            </div>
          </TabsContent>

          <TabsContent value="procedures"><TableSection count={`${procedures.length} procedimentos cadastrados`} actionLabel="Novo Procedimento" onAction={() => { setEditingProc(null); setProcForm(emptyProcedure); setShowProcForm(true); }}><thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Procedimento</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Valor Padrão</th><th className="text-center text-xs font-medium text-muted-foreground p-3">Duração</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th></tr></thead><tbody>{procedures.map(proc => <tr key={proc.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3"><div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Stethoscope className="h-3.5 w-3.5 text-primary" /></div><span className="text-sm font-medium text-foreground">{proc.name}</span></div></td><td className="p-3 text-sm font-semibold text-foreground text-right"><span className="flex items-center justify-end gap-1"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />R$ {proc.defaultPrice.toFixed(2)}</span></td><td className="p-3 text-sm text-muted-foreground text-center"><span className="flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5" />{proc.averageDuration} min</span></td><td className="p-3 text-right"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingProc(proc); setProcForm({ name: proc.name, defaultPrice: proc.defaultPrice, averageDuration: proc.averageDuration }); setShowProcForm(true); }}><Edit2 className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteProcId(proc.id)}><Trash2 className="h-3 w-3" /></Button></td></tr>)}</tbody></TableSection></TabsContent>

          <TabsContent value="suppliers"><TableSection count={`${suppliers.length} fornecedores cadastrados`} actionLabel="Novo Fornecedor" onAction={() => { setEditingSupplier(null); setSupplierForm(emptySupplier); setShowSupplierForm(true); }}><thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Fornecedor</th><th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">CNPJ</th><th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Contato</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Categoria</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th></tr></thead><tbody>{suppliers.map(sup => <tr key={sup.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3"><div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building className="h-3.5 w-3.5 text-primary" /></div><div><p className="text-sm font-medium text-foreground">{sup.name}</p>{sup.notes && <p className="text-[10px] text-muted-foreground">{sup.notes}</p>}</div></div></td><td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{sup.cnpj}</td><td className="p-3 hidden md:table-cell"><p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{sup.phone}</p></td><td className="p-3"><Badge variant="secondary" className="text-xs font-normal">{sup.category || "Sem categoria"}</Badge></td><td className="p-3 text-right"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingSupplier(sup); setSupplierForm({ name: sup.name, cnpj: sup.cnpj, phone: sup.phone, email: sup.email, category: sup.category, notes: sup.notes }); setShowSupplierForm(true); }}><Edit2 className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteSupplierId(sup.id)}><Trash2 className="h-3 w-3" /></Button></td></tr>)}</tbody></TableSection></TabsContent>

          <TabsContent value="categories"><TableSection count={`${categories.length} categorias cadastradas`} actionLabel="Nova Categoria" onAction={() => { setEditingCat(null); setCatForm(emptyCategory); setShowCatForm(true); }}><thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Tipo</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th></tr></thead><tbody>{categories.map(cat => <tr key={cat.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3"><div className="flex items-center gap-2.5"><div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cat.type === "income" ? "bg-success/10" : "bg-destructive/10"}`}><Tag className={`h-3.5 w-3.5 ${cat.type === "income" ? "text-success" : "text-destructive"}`} /></div><span className="text-sm font-medium text-foreground">{cat.name}</span></div></td><td className="p-3"><Badge variant="secondary" className="text-xs font-normal">{cat.type === "income" ? "Receita" : "Despesa"}</Badge></td><td className="p-3 text-right"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, type: cat.type }); setShowCatForm(true); }}><Edit2 className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteCatId(cat.id)}><Trash2 className="h-3 w-3" /></Button></td></tr>)}</tbody></TableSection></TabsContent>
        </Tabs>

        <Dialog open={showPatientForm} onOpenChange={open => { setShowPatientForm(open); if (!open) setEditingPatient(null); }}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingPatient ? "Editar Paciente" : "Cadastrar Paciente"}</DialogTitle></DialogHeader><div className="space-y-6 mt-2"><div><div className="flex items-center gap-2 mb-3"><User className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Dados Pessoais</h3></div><div className="grid grid-cols-2 gap-3"><div className="col-span-2"><Label>Nome completo</Label><Input value={patientForm.name} onChange={e => setPatientForm({ ...patientForm, name: e.target.value })} /></div><div><Label>CPF</Label><Input value={patientForm.cpf} onChange={e => setPatientForm({ ...patientForm, cpf: e.target.value })} /></div><div><Label>Data de nascimento</Label><Input type="date" value={patientForm.birthDate} onChange={e => setPatientForm({ ...patientForm, birthDate: e.target.value })} /></div></div></div><Separator /><div><div className="flex items-center gap-2 mb-3"><Phone className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Contato</h3></div><div className="grid grid-cols-2 gap-3"><div><Label>Telefone</Label><Input value={patientForm.phone} onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })} /></div><div><Label>Email</Label><Input value={patientForm.email} onChange={e => setPatientForm({ ...patientForm, email: e.target.value })} /></div><div className="col-span-2"><Label>Endereço</Label><Input value={patientForm.address} onChange={e => setPatientForm({ ...patientForm, address: e.target.value })} /></div></div></div><Separator /><div><div className="flex items-center gap-2 mb-3"><Heart className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Informações Clínicas</h3></div><div className="grid grid-cols-2 gap-3"><div><Label>Convênio</Label><Input value={patientForm.insurance} onChange={e => setPatientForm({ ...patientForm, insurance: e.target.value })} /></div><div><Label>Alergias / Alertas</Label><Input value={patientForm.notes} onChange={e => setPatientForm({ ...patientForm, notes: e.target.value })} /></div><div className="col-span-2"><Label>Observações médicas</Label><Textarea rows={3} value={patientForm.medicalNotes} onChange={e => setPatientForm({ ...patientForm, medicalNotes: e.target.value })} /></div></div></div></div><div className="flex justify-end gap-2 mt-6"><Button variant="outline" onClick={() => setShowPatientForm(false)}>Cancelar</Button><Button onClick={savePatient}>{editingPatient ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div>{selected?.name}</DialogTitle></DialogHeader>{selected && <Tabs defaultValue="info" className="mt-2"><TabsList className="w-full justify-start"><TabsTrigger value="info">Dados Pessoais</TabsTrigger><TabsTrigger value="history">Atendimentos ({patientHistory.length})</TabsTrigger><TabsTrigger value="records">Prontuário</TabsTrigger></TabsList><TabsContent value="info" className="space-y-4 mt-4"><div className="grid grid-cols-2 gap-4 text-sm"><Info label="CPF" value={selected.cpf} /><Info label="Nascimento" value={selected.birthDate ? new Date(selected.birthDate + "T12:00:00").toLocaleDateString("pt-BR") : "-"} /><Info label="Telefone" value={selected.phone} icon={<Phone className="h-3 w-3" />} /><Info label="Email" value={selected.email} icon={<Mail className="h-3 w-3" />} /><Info label="Endereço" value={selected.address} icon={<MapPin className="h-3 w-3" />} wide /><div className="space-y-1"><span className="text-muted-foreground text-xs">Convênio</span><Badge variant="secondary">{selected.insurance}</Badge></div><Info label="Cadastro" value={new Date(selected.createdAt).toLocaleDateString("pt-BR")} /></div>{selected.notes && <div className="p-3 rounded-lg bg-warning/10 text-warning text-sm">⚠ {selected.notes}</div>}{selected.medicalNotes && <div className="p-3 rounded-lg bg-primary/5 text-sm"><p className="font-semibold text-xs mb-1 text-muted-foreground">Observações médicas</p>{selected.medicalNotes}</div>}</TabsContent><TabsContent value="history" className="mt-4 space-y-2">{patientHistory.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum atendimento registrado</p> : patientHistory.map(apt => <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"><div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">{apt.procedure_name}</p><p className="text-xs text-muted-foreground">{new Date(apt.appointment_date + "T12:00:00").toLocaleDateString("pt-BR")} • {apt.appointment_time?.slice(0, 5)} • {apt.professional_name}</p></div></div><Badge className={`${statusBadge[apt.status]} border-0`}>{statusLabels[apt.status]}</Badge></div>)}</TabsContent><TabsContent value="records" className="mt-4"><p className="text-sm text-muted-foreground text-center py-8"><FileText className="h-4 w-4 inline mr-1" /> Prontuário integrado em módulo próprio.</p></TabsContent></Tabs>}</DialogContent></Dialog>

        <Dialog open={showProcForm} onOpenChange={open => { setShowProcForm(open); if (!open) setEditingProc(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingProc ? "Editar Procedimento" : "Novo Procedimento"}</DialogTitle></DialogHeader><div className="space-y-3 mt-2"><div><Label>Nome do procedimento</Label><Input value={procForm.name} onChange={e => setProcForm({ ...procForm, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Valor padrão (R$)</Label><Input type="number" value={procForm.defaultPrice} onChange={e => setProcForm({ ...procForm, defaultPrice: Number(e.target.value) })} /></div><div><Label>Duração média (min)</Label><Input type="number" value={procForm.averageDuration} onChange={e => setProcForm({ ...procForm, averageDuration: Number(e.target.value) })} /></div></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowProcForm(false)}>Cancelar</Button><Button onClick={saveProcedure}>{editingProc ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <Dialog open={showSupplierForm} onOpenChange={open => { setShowSupplierForm(open); if (!open) setEditingSupplier(null); }}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader><div className="space-y-3 mt-2"><div><Label>Nome / Razão Social</Label><Input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>CNPJ</Label><Input value={supplierForm.cnpj} onChange={e => setSupplierForm({ ...supplierForm, cnpj: e.target.value })} /></div><div><Label>Categoria</Label><Input value={supplierForm.category} onChange={e => setSupplierForm({ ...supplierForm, category: e.target.value })} /></div><div><Label>Telefone</Label><Input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div><div><Label>Email</Label><Input value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div></div><div><Label>Observações</Label><Textarea rows={2} value={supplierForm.notes} onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })} /></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowSupplierForm(false)}>Cancelar</Button><Button onClick={saveSupplier}>{editingSupplier ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <Dialog open={showCatForm} onOpenChange={open => { setShowCatForm(open); if (!open) setEditingCat(null); }}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader><div className="space-y-3 mt-2"><div><Label>Nome da categoria</Label><Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} /></div><div><Label>Tipo</Label><Select value={catForm.type} onValueChange={(type: "income" | "expense") => setCatForm({ ...catForm, type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Despesa</SelectItem><SelectItem value="income">Receita</SelectItem></SelectContent></Select></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowCatForm(false)}>Cancelar</Button><Button onClick={saveCategory}>{editingCat ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <ConfirmDialog open={!!deletePatientId} onOpenChange={() => setDeletePatientId(null)} title="Excluir Paciente" description="Tem certeza que deseja excluir este paciente?" onConfirm={() => deletePatientId && removeRecord("patients", deletePatientId, () => { setPatients(prev => prev.filter(p => p.id !== deletePatientId)); setDeletePatientId(null); }, "Paciente")} />
        <ConfirmDialog open={!!deleteProcId} onOpenChange={() => setDeleteProcId(null)} title="Excluir Procedimento" description="Tem certeza que deseja excluir este procedimento?" onConfirm={() => deleteProcId && removeRecord("procedures", deleteProcId, () => { setProcedures(prev => prev.filter(p => p.id !== deleteProcId)); setDeleteProcId(null); }, "Procedimento")} />
        <ConfirmDialog open={!!deleteSupplierId} onOpenChange={() => setDeleteSupplierId(null)} title="Excluir Fornecedor" description="Tem certeza que deseja excluir este fornecedor?" onConfirm={() => deleteSupplierId && removeRecord("suppliers", deleteSupplierId, () => { setSuppliers(prev => prev.filter(s => s.id !== deleteSupplierId)); setDeleteSupplierId(null); }, "Fornecedor")} />
        <ConfirmDialog open={!!deleteCatId} onOpenChange={() => setDeleteCatId(null)} title="Excluir Categoria" description="Tem certeza que deseja excluir esta categoria?" onConfirm={() => deleteCatId && removeRecord("financial_categories", deleteCatId, () => { setCategories(prev => prev.filter(c => c.id !== deleteCatId)); setDeleteCatId(null); }, "Categoria")} />
      </div>
    </ClinicLayout>
  );
}

function TableSection({ count, actionLabel, onAction, children }: { count: string; actionLabel: string; onAction: () => void; children: React.ReactNode }) {
  return <div className="space-y-4"><div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">{count}</p><Button onClick={onAction}><Plus className="h-4 w-4 mr-1.5" />{actionLabel}</Button></div><Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full">{children}</table></div></Card></div>;
}

function Info({ label, value, icon, wide }: { label: string; value: string; icon?: React.ReactNode; wide?: boolean }) {
  return <div className={`space-y-1 ${wide ? "col-span-2" : ""}`}><span className="text-muted-foreground text-xs">{label}</span><p className="font-medium flex items-center gap-1">{icon}{value || "-"}</p></div>;
}
