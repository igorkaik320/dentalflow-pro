import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { parseCurrencyInput } from "@/lib/utils";
import type { FinancialCategory, Payable, Professional, Receivable, Supplier } from "@/data/mockData";
import { toast } from "sonner";
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Plus, Edit2, Trash2 } from "lucide-react";

type ReceivableForm = Omit<Receivable, "id" | "patientId" | "professionalId">;
type PayableForm = Omit<Payable, "id"> & { supplierId?: string };

const emptyReceivable: ReceivableForm = {
  patientName: "",
  professionalName: "",
  procedure: "",
  amount: 0,
  paymentMethod: "Pix",
  installments: 1,
  status: "open",
  dueDate: new Date().toISOString().split("T")[0],
};

const emptyPayable: PayableForm = {
  supplier: "",
  supplierId: undefined,
  description: "",
  category: "",
  amount: 0,
  dueDate: new Date().toISOString().split("T")[0],
  status: "open",
};

const paymentMethods = ["Pix", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Boleto"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const statusBadge: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};
const statusLabel: Record<string, string> = {
  open: "Aberto", paid: "Pago", overdue: "Atrasado",
};

function mapReceivable(row: any): Receivable {
  return {
    id: row.id,
    patientId: row.patient_id || "",
    patientName: row.patient_name || "",
    professionalId: row.professional_id || "",
    professionalName: row.professional_name || "",
    procedure: row.procedure_name || "",
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || "",
    installments: Number(row.installments || 1),
    status: row.status || "open",
    dueDate: row.due_date,
    paidDate: row.paid_date || undefined,
  };
}

function mapPayable(row: any): Payable {
  return {
    id: row.id,
    supplier: row.supplier || "",
    description: row.description || "",
    category: row.category || "",
    amount: Number(row.amount || 0),
    dueDate: row.due_date,
    status: row.status || "open",
    paidDate: row.paid_date || undefined,
  };
}

function mapProfessional(row: any): Professional {
  return { id: row.id, name: row.name || "", specialty: row.specialty || "", commissionRate: Number(row.commission_rate || 0), phone: row.phone || "", email: row.email || "", active: Boolean(row.active) };
}

function mapCategory(row: any): FinancialCategory {
  return { id: row.id, name: row.name || "", type: row.type || "expense" };
}

function mapSupplier(row: any): Supplier {
  return { id: row.id, name: row.name || "", cnpj: row.cnpj || "", phone: row.phone || "", email: row.email || "", category: row.category || "", notes: row.notes || "" };
}

export default function FinancialPage() {
  const { clinic, user } = useClinic();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cashSession, setCashSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRec, setEditingRec] = useState<Receivable | null>(null);
  const [recForm, setRecForm] = useState<ReceivableForm>(emptyReceivable);
  const [deleteRecId, setDeleteRecId] = useState<string | null>(null);

  const [showPayForm, setShowPayForm] = useState(false);
  const [editingPay, setEditingPay] = useState<Payable | null>(null);
  const [payForm, setPayForm] = useState<PayableForm>(emptyPayable);
  const [deletePayId, setDeletePayId] = useState<string | null>(null);

  useEffect(() => {
    if (!clinic.id) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [clinic.id]);

  const loadData = async () => {
    if (!clinic.id) return;
    setLoading(true);
    const [recRes, payRes, profRes, catRes, supplierRes, cashRes] = await Promise.all([
      db.from("receivables").select("*").eq("clinic_id", clinic.id).order("due_date", { ascending: false }),
      db.from("payables").select("*").eq("clinic_id", clinic.id).order("due_date", { ascending: false }),
      db.from("professionals").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("financial_categories").select("*").eq("clinic_id", clinic.id).order("type").order("name"),
      db.from("suppliers").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("cash_sessions").select("*").eq("clinic_id", clinic.id).is("closed_at", null).order("opened_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLoading(false);
    const error = recRes.error || payRes.error || profRes.error || catRes.error || supplierRes.error || cashRes.error;
    if (error) return toast.error("Não foi possível carregar o financeiro.");
    setReceivables((recRes.data || []).map(mapReceivable));
    setPayables((payRes.data || []).map(mapPayable));
    setProfessionals((profRes.data || []).map(mapProfessional));
    setCategories((catRes.data || []).map(mapCategory));
    setSuppliers((supplierRes.data || []).map(mapSupplier));
    setCashSession(cashRes.data || null);
  };

  const expenseCategories = useMemo(() => categories.filter(c => c.type === "expense"), [categories]);

  const totals = useMemo(() => ({
    totalReceivables: receivables.reduce((a, b) => a + b.amount, 0),
    totalPaid: receivables.filter(r => r.status === "paid").reduce((a, b) => a + b.amount, 0),
    totalPayables: payables.reduce((a, b) => a + b.amount, 0),
    paidPayables: payables.filter(p => p.status === "paid").reduce((a, b) => a + b.amount, 0),
  }), [receivables, payables]);

  const openRec = (rec?: Receivable) => {
    setEditingRec(rec || null);
    setRecForm(rec ? {
      patientName: rec.patientName,
      professionalName: rec.professionalName,
      procedure: rec.procedure,
      amount: rec.amount,
      paymentMethod: rec.paymentMethod || "Pix",
      installments: rec.installments,
      status: rec.status,
      dueDate: rec.dueDate,
      paidDate: rec.paidDate,
    } : emptyReceivable);
    setShowRecForm(true);
  };

  const openPay = (pay?: Payable) => {
    setEditingPay(pay || null);
    setPayForm(pay ? { supplier: pay.supplier, description: pay.description, category: pay.category, amount: pay.amount, dueDate: pay.dueDate, status: pay.status, paidDate: pay.paidDate } : emptyPayable);
    setShowPayForm(true);
  };

  const saveReceivable = async () => {
    if (!clinic.id) return toast.error("Clínica não vinculada. Verifique o cadastro da clínica atualizados.");
    if (!recForm.patientName.trim() || !recForm.procedure.trim()) return toast.error("Informe paciente e procedimento.");
    const payload = {
      clinic_id: clinic.id,
      patient_name: recForm.patientName.trim(),
      professional_name: recForm.professionalName,
      procedure_name: recForm.procedure.trim(),
      amount: Number(recForm.amount || 0),
      payment_method: recForm.paymentMethod,
      installments: Number(recForm.installments || 1),
      status: recForm.status,
      due_date: recForm.dueDate,
      paid_date: recForm.status === "paid" ? (recForm.paidDate || new Date().toISOString().split("T")[0]) : null,
    };
    const query = editingRec
      ? db.from("receivables").update(payload).eq("id", editingRec.id).eq("clinic_id", clinic.id).select().single()
      : db.from("receivables").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Não foi possível salvar a conta a receber.");
    const saved = mapReceivable(data);
    setReceivables(prev => editingRec ? prev.map(r => r.id === saved.id ? saved : r) : [saved, ...prev]);
    toast.success(editingRec ? "Conta a receber atualizada" : "Conta a receber registrada");
    setShowRecForm(false);
    setEditingRec(null);
  };

  const savePayable = async () => {
    if (!clinic.id) return toast.error("Clínica não vinculada. Verifique o cadastro da clínica atualizados.");
    if (!clinic.id || !payForm.supplier.trim() || !payForm.description.trim()) return toast.error("Informe fornecedor e descrição.");
    const payload = {
      clinic_id: clinic.id,
      supplier_id: payForm.supplierId || null,
      supplier: payForm.supplier.trim(),
      description: payForm.description.trim(),
      category: payForm.category,
      amount: Number(payForm.amount || 0),
      due_date: payForm.dueDate,
      status: payForm.status,
      paid_date: payForm.status === "paid" ? (payForm.paidDate || new Date().toISOString().split("T")[0]) : null,
    };
    const query = editingPay
      ? db.from("payables").update(payload).eq("id", editingPay.id).eq("clinic_id", clinic.id).select().single()
      : db.from("payables").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Não foi possível salvar a conta a pagar.");
    const saved = mapPayable(data);
    setPayables(prev => editingPay ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]);
    toast.success(editingPay ? "Conta a pagar atualizada" : "Conta a pagar registrada");
    setShowPayForm(false);
    setEditingPay(null);
  };

  const deleteRecord = async (table: "receivables" | "payables", id: string) => {
    if (!clinic.id) return toast.error("Clínica não vinculada. Verifique o cadastro da clínica atualizados.");
    const { error } = await db.from(table).delete().eq("id", id).eq("clinic_id", clinic.id);
    if (error) return toast.error("Não foi possível excluir o lançamento.");
    if (table === "receivables") {
      setReceivables(prev => prev.filter(r => r.id !== id));
      setDeleteRecId(null);
    } else {
      setPayables(prev => prev.filter(p => p.id !== id));
      setDeletePayId(null);
    }
    toast.success("Lançamento excluído com sucesso");
  };

  const openCash = async () => {
    if (!clinic.id) return toast.error("Clínica não vinculada. Verifique o cadastro da clínica atualizados.");
    if (cashSession) return toast.error("Já existe um caixa aberto.");
    const { data, error } = await db.from("cash_sessions").insert({
      clinic_id: clinic.id,
      opened_by: user?.id || null,
      opening_balance: totals.totalPaid - totals.paidPayables,
    }).select().single();
    if (error) return toast.error("Não foi possível abrir o caixa. Verifique se a migration cash_sessions foi aplicada.");
    setCashSession(data);
    toast.success("Caixa aberto com sucesso.");
  };

  const closeCash = async () => {
    if (!clinic.id || !cashSession) return toast.error("Não há caixa aberto.");
    const closingBalance = totals.totalPaid - totals.paidPayables;
    const { data, error } = await db.from("cash_sessions").update({
      closed_by: user?.id || null,
      closed_at: new Date().toISOString(),
      closing_balance: closingBalance,
    }).eq("id", cashSession.id).eq("clinic_id", clinic.id).select().single();
    if (error) return toast.error("Não foi possível fechar o caixa.");
    setCashSession(null);
    toast.success(`Caixa fechado com saldo de ${formatCurrency(Number(data.closing_balance || closingBalance))}.`);
  };

  return (
    <ClinicLayout title="Financeiro" subtitle="Contas a receber, contas a pagar, comissões e caixa">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="stat-card"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><ArrowUpCircle className="h-5 w-5 text-success" /></div><div><p className="text-xs text-muted-foreground">A Receber</p><p className="text-xl font-bold text-foreground">{formatCurrency(totals.totalReceivables)}</p></div></div></Card>
          <Card className="stat-card"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">Recebido</p><p className="text-xl font-bold text-foreground">{formatCurrency(totals.totalPaid)}</p></div></div></Card>
          <Card className="stat-card"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5 text-destructive" /></div><div><p className="text-xs text-muted-foreground">A Pagar</p><p className="text-xl font-bold text-foreground">{formatCurrency(totals.totalPayables)}</p></div></div></Card>
        </div>

        <Tabs defaultValue="receivables">
          <TabsList className="flex-wrap"><TabsTrigger value="receivables">Contas a Receber</TabsTrigger><TabsTrigger value="payables">Contas a Pagar</TabsTrigger><TabsTrigger value="commissions">Comissões</TabsTrigger><TabsTrigger value="cashflow">Caixa</TabsTrigger></TabsList>

          <TabsContent value="receivables">
            <FinanceTable title="Contas a Receber" onNew={() => openRec()} headers={["Paciente", "Procedimento", "Profissional", "Valor", "Pagamento", "Vencimento", "Status", "Ações"]}>
              {loading ? <EmptyRow text="Carregando lançamentos..." span={8} /> : receivables.map(r => <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3 text-sm font-medium text-foreground">{r.patientName}</td><td className="p-3 text-sm text-muted-foreground">{r.procedure}</td><td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{r.professionalName}</td><td className="p-3 text-sm font-semibold text-foreground text-right">{formatCurrency(r.amount)}</td><td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{r.paymentMethod}{r.installments > 1 ? ` (${r.installments}x)` : ""}</td><td className="p-3 text-sm text-muted-foreground">{new Date(r.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</td><td className="p-3 text-center"><span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusBadge[r.status]}`}>{statusLabel[r.status]}</span></td><td className="p-3 text-right"><ActionButtons onEdit={() => openRec(r)} onDelete={() => setDeleteRecId(r.id)} /></td></tr>)}
              {!loading && receivables.length === 0 && <EmptyRow text="Nenhuma conta a receber registrada." span={8} />}
            </FinanceTable>
          </TabsContent>

          <TabsContent value="payables">
            <FinanceTable title="Contas a Pagar" onNew={() => openPay()} headers={["Fornecedor", "Descrição", "Categoria", "Valor", "Vencimento", "Status", "Ações"]}>
              {loading ? <EmptyRow text="Carregando lançamentos..." span={7} /> : payables.map(p => <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3 text-sm font-medium text-foreground">{p.supplier}</td><td className="p-3 text-sm text-muted-foreground">{p.description}</td><td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{p.category}</td><td className="p-3 text-sm font-semibold text-foreground text-right">{formatCurrency(p.amount)}</td><td className="p-3 text-sm text-muted-foreground">{new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</td><td className="p-3 text-center"><span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusBadge[p.status]}`}>{statusLabel[p.status]}</span></td><td className="p-3 text-right"><ActionButtons onEdit={() => openPay(p)} onDelete={() => setDeletePayId(p.id)} /></td></tr>)}
              {!loading && payables.length === 0 && <EmptyRow text="Nenhuma conta a pagar registrada." span={7} />}
            </FinanceTable>
          </TabsContent>

          <TabsContent value="commissions"><Card className="p-5"><h3 className="text-sm font-semibold mb-4">Comissões por Profissional</h3><div className="space-y-4">{professionals.filter(p => p.active).map(prof => { const profReceivables = receivables.filter(r => r.professionalName === prof.name && r.status === "paid"); const totalBilled = profReceivables.reduce((a, b) => a + b.amount, 0); const commission = totalBilled * (prof.commissionRate / 100); return <div key={prof.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"><div><p className="text-sm font-semibold text-foreground">{prof.name}</p><p className="text-xs text-muted-foreground">{prof.specialty} • {prof.commissionRate}% comissão</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Faturado: {formatCurrency(totalBilled)}</p><p className="text-sm font-bold text-primary">Comissão: {formatCurrency(commission)}</p></div></div>; })}</div></Card></TabsContent>

          <TabsContent value="cashflow"><Card className="p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-semibold">Controle de Caixa</h3><p className="text-xs text-muted-foreground">{cashSession ? `Aberto desde ${new Date(cashSession.opened_at).toLocaleString("pt-BR")}` : "Nenhum caixa aberto"}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={openCash} disabled={!!cashSession}>Abrir Caixa</Button><Button size="sm" variant="destructive" onClick={closeCash} disabled={!cashSession}>Fechar Caixa</Button></div></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"><div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">Saldo Inicial</p><p className="text-lg font-bold text-foreground">{formatCurrency(Number(cashSession?.opening_balance || 0))}</p></div><div className="p-3 rounded-lg bg-success/10 text-center"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-lg font-bold text-success">{formatCurrency(totals.totalPaid)}</p></div><div className="p-3 rounded-lg bg-destructive/10 text-center"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-lg font-bold text-destructive">{formatCurrency(totals.paidPayables)}</p></div><div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-xs text-muted-foreground">Saldo Final</p><p className="text-lg font-bold text-primary">{formatCurrency(totals.totalPaid - totals.paidPayables)}</p></div></div><div className="space-y-2">{receivables.filter(r => r.status === "paid").slice(0, 5).map(r => <div key={r.id} className="flex justify-between items-center p-3 rounded bg-success/5 border-l-2 border-success"><div><p className="text-sm font-medium text-foreground">{r.procedure} - {r.patientName}</p><p className="text-xs text-muted-foreground">{r.paymentMethod} • {r.professionalName}</p></div><p className="text-sm font-semibold text-success">+ {formatCurrency(r.amount)}</p></div>)}{payables.filter(p => p.status === "paid").slice(0, 5).map(p => <div key={p.id} className="flex justify-between items-center p-3 rounded bg-destructive/5 border-l-2 border-destructive"><div><p className="text-sm font-medium text-foreground">{p.description}</p><p className="text-xs text-muted-foreground">{p.supplier}</p></div><p className="text-sm font-semibold text-destructive">- {formatCurrency(p.amount)}</p></div>)}</div></Card></TabsContent>
        </Tabs>

        <Dialog open={showRecForm} onOpenChange={open => { setShowRecForm(open); if (!open) setEditingRec(null); }}><DialogContent><DialogHeader><DialogTitle>{editingRec ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 mt-2"><div className="col-span-2"><Label>Paciente</Label><Input value={recForm.patientName} onChange={e => setRecForm({ ...recForm, patientName: e.target.value })} /></div><div className="col-span-2"><Label>Procedimento</Label><Input value={recForm.procedure} onChange={e => setRecForm({ ...recForm, procedure: e.target.value })} /></div><div><Label>Valor</Label><Input inputMode="numeric" value={formatCurrency(recForm.amount)} onChange={e => setRecForm({ ...recForm, amount: parseCurrencyInput(e.target.value) })} /></div><div><Label>Parcelas</Label><Input type="number" value={recForm.installments} onChange={e => setRecForm({ ...recForm, installments: Number(e.target.value) })} /></div><div><Label>Forma de Pagamento</Label><Select value={recForm.paymentMethod} onValueChange={paymentMethod => setRecForm({ ...recForm, paymentMethod })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select></div><div><Label>Vencimento</Label><Input type="date" value={recForm.dueDate} onChange={e => setRecForm({ ...recForm, dueDate: e.target.value })} /></div><div className="col-span-2"><Label>Profissional</Label><Select value={recForm.professionalName || "none"} onValueChange={professionalName => setRecForm({ ...recForm, professionalName: professionalName === "none" ? "" : professionalName })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem profissional</SelectItem>{professionals.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select></div><div className="col-span-2"><Label>Status</Label><Select value={recForm.status} onValueChange={(status: "open" | "paid" | "overdue") => setRecForm({ ...recForm, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Aberto</SelectItem><SelectItem value="paid">Pago</SelectItem><SelectItem value="overdue">Atrasado</SelectItem></SelectContent></Select></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowRecForm(false)}>Cancelar</Button><Button onClick={saveReceivable}>{editingRec ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <Dialog open={showPayForm} onOpenChange={open => { setShowPayForm(open); if (!open) setEditingPay(null); }}><DialogContent><DialogHeader><DialogTitle>{editingPay ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 mt-2"><div className="col-span-2"><Label>Fornecedor</Label><Select value={payForm.supplierId || "custom"} onValueChange={value => { if (value === "custom") setPayForm({ ...payForm, supplierId: undefined }); else { const supplier = suppliers.find(s => s.id === value); setPayForm({ ...payForm, supplierId: value, supplier: supplier?.name || "" }); } }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="custom">Fornecedor personalizado</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><Input className="mt-2" placeholder="Nome do fornecedor" value={payForm.supplier} onChange={e => setPayForm({ ...payForm, supplier: e.target.value, supplierId: undefined })} /></div><div className="col-span-2"><Label>Descrição</Label><Input value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })} /></div><div><Label>Categoria</Label><Select value={payForm.category || "none"} onValueChange={category => setPayForm({ ...payForm, category: category === "none" ? "" : category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem categoria</SelectItem>{expenseCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Valor</Label><Input inputMode="numeric" value={formatCurrency(payForm.amount)} onChange={e => setPayForm({ ...payForm, amount: parseCurrencyInput(e.target.value) })} /></div><div><Label>Vencimento</Label><Input type="date" value={payForm.dueDate} onChange={e => setPayForm({ ...payForm, dueDate: e.target.value })} /></div><div><Label>Status</Label><Select value={payForm.status} onValueChange={(status: "open" | "paid" | "overdue") => setPayForm({ ...payForm, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Aberto</SelectItem><SelectItem value="paid">Pago</SelectItem><SelectItem value="overdue">Atrasado</SelectItem></SelectContent></Select></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowPayForm(false)}>Cancelar</Button><Button onClick={savePayable}>{editingPay ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <ConfirmDialog open={!!deleteRecId} onOpenChange={() => setDeleteRecId(null)} title="Excluir Conta a Receber" description="Tem certeza que deseja excluir esta conta?" onConfirm={() => deleteRecId && deleteRecord("receivables", deleteRecId)} />
        <ConfirmDialog open={!!deletePayId} onOpenChange={() => setDeletePayId(null)} title="Excluir Conta a Pagar" description="Tem certeza que deseja excluir esta conta?" onConfirm={() => deletePayId && deleteRecord("payables", deletePayId)} />
      </div>
    </ClinicLayout>
  );
}

function FinanceTable({ title, onNew, headers, children }: { title: string; onNew: () => void; headers: string[]; children: ReactNode }) {
  return <Card className="overflow-hidden"><div className="p-4 border-b border-border flex justify-between items-center"><h3 className="text-sm font-semibold">{title}</h3><Button size="sm" onClick={onNew}><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-border bg-muted/50">{headers.map((h, i) => <th key={h} className={`${i === headers.length - 1 || h === "Valor" ? "text-right" : h === "Status" ? "text-center" : "text-left"} text-xs font-medium text-muted-foreground p-3 ${["Profissional", "Pagamento", "Categoria"].includes(h) ? "hidden md:table-cell" : ""}`}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div></Card>;
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button></div>;
}

function EmptyRow({ text, span }: { text: string; span: number }) {
  return <tr><td colSpan={span} className="p-8 text-center text-sm text-muted-foreground">{text}</td></tr>;
}

