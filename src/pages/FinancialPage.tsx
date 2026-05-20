import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntitySearchInput } from "@/components/EntitySearchInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { clearPersistentState, usePersistentState } from "@/hooks/usePersistentState";
import { db } from "@/lib/clinicCloud";
import { formatCurrency, parseCurrencyInput } from "@/lib/utils";
import type { FinancialCategory, Payable, PayableInstallment, Professional, Receivable, Supplier } from "@/data/mockData";
import { toast } from "sonner";
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Plus, Edit2, Trash2, CalendarDays } from "lucide-react";

type ReceivableForm = Omit<Receivable, "id" | "professionalId">;
type ClientOption = { id: string; name: string; cpf?: string };
type ProcedureOption = { id: string; name: string; defaultPrice: number; averageDuration: number };
type FinancialStatus = "open" | "paid" | "overdue";
type InstallmentForm = Omit<PayableInstallment, "payableId">;
type PayableWithInstallments = Payable & { supplierId?: string; installments: PayableInstallment[] };
type PayableForm = Omit<Payable, "id" | "installments"> & { supplierId?: string; installmentsCount: number; installments: InstallmentForm[] };

const today = () => new Date().toISOString().split("T")[0];

const emptyReceivable: ReceivableForm = {
  patientId: "",
  patientName: "",
  professionalName: "",
  procedure: "",
  category: "",
  amount: 0,
  paymentMethod: "Pix",
  installments: 1,
  status: "open",
  dueDate: today(),
};

const emptyPayable: PayableForm = {
  supplier: "",
  supplierId: undefined,
  description: "",
  category: "",
  amount: 0,
  dueDate: today(),
  status: "open",
  installmentsCount: 1,
  installments: [],
};

const paymentMethods = ["Pix", "Cartao Credito", "Cartao Debito", "Dinheiro", "Boleto"];
const storageKeys = {
  activeTab: "dentalflow.financial.activeTab",
  receivableFilter: "dentalflow.financial.receivableFilter",
  receivableStart: "dentalflow.financial.receivableStart",
  receivableEnd: "dentalflow.financial.receivableEnd",
  showReceivableForm: "dentalflow.financial.showReceivableForm",
  payableFilter: "dentalflow.financial.payableFilter",
  payableStart: "dentalflow.financial.payableStart",
  payableEnd: "dentalflow.financial.payableEnd",
  showPayableForm: "dentalflow.financial.showPayableForm",
  cashFilter: "dentalflow.financial.cashFilter",
  cashStart: "dentalflow.financial.cashStart",
  cashEnd: "dentalflow.financial.cashEnd",
  receivableDraft: "dentalflow.financial.receivableDraft",
  payableDraft: "dentalflow.financial.payableDraft",
};

const statusBadge: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};
const statusLabel: Record<string, string> = {
  open: "Aberto", paid: "Pago", overdue: "Atrasado",
};

function addMonths(dateText: string, months: number) {
  const date = new Date(`${dateText}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split("T")[0];
}

function normalizeInstallmentStatus(status: string, dueDate: string): "open" | "paid" | "overdue" {
  if (status === "paid") return "paid";
  if (status === "overdue") return "overdue";
  return dueDate < today() ? "overdue" : "open";
}

function aggregateStatus(installments: PayableInstallment[], fallback: Payable["status"]) {
  if (installments.length === 0) return fallback;
  if (installments.every((item) => item.status === "paid")) return "paid";
  if (installments.some((item) => item.status === "overdue")) return "overdue";
  return "open";
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function isWithinPeriod(dateText: string | undefined, start: string, end: string) {
  if (!dateText) return false;
  if (start && dateText < start) return false;
  if (end && dateText > end) return false;
  return true;
}

function hasReceivableDraft(form: ReceivableForm) {
  return Boolean(form.patientName || form.patientId || form.procedure || form.amount || form.professionalName || form.paidDate);
}

function hasPayableDraft(form: PayableForm) {
  return Boolean(form.supplier || form.description || form.category || form.amount || form.companyName || form.installments.some((item) => item.amount || item.notes || item.paidDate));
}

function buildInstallments(amount: number, count: number, firstDueDate: string): InstallmentForm[] {
  const safeCount = Math.max(1, Number(count || 1));
  const base = Math.floor((Number(amount || 0) * 100) / safeCount) / 100;
  const remainder = Math.round((Number(amount || 0) - base * safeCount) * 100) / 100;
  return Array.from({ length: safeCount }, (_, index) => {
    const installmentAmount = index === safeCount - 1 ? Math.round((base + remainder) * 100) / 100 : base;
    const dueDate = addMonths(firstDueDate || today(), index);
    return {
      id: `new-${index + 1}`,
      installmentNumber: index + 1,
      amount: installmentAmount,
      dueDate,
      paidDate: undefined,
      paidAmount: undefined,
      status: normalizeInstallmentStatus("open", dueDate),
      notes: "",
    };
  });
}

function mapReceivable(row: any): Receivable {
  return {
    id: row.id,
    patientId: row.patient_id || "",
    patientName: row.patient_name || "",
    professionalId: row.professional_id || "",
    professionalName: row.professional_name || "",
    procedure: row.procedure_name || "",
    category: row.category || "",
    amount: Number(row.amount || 0),
    paymentMethod: row.payment_method || "",
    installments: Number(row.installments || 1),
    status: row.status || "open",
    dueDate: row.due_date,
    paidDate: row.paid_date || undefined,
  };
}

function mapInstallment(row: any): PayableInstallment {
  return {
    id: row.id,
    payableId: row.payable_id,
    installmentNumber: Number(row.installment_number || 1),
    amount: Number(row.amount || 0),
    dueDate: row.due_date,
    paidDate: row.paid_date || undefined,
    paidAmount: row.paid_amount == null ? undefined : Number(row.paid_amount),
    status: normalizeInstallmentStatus(row.status || "open", row.due_date),
    notes: row.notes || "",
  };
}

function mapPayable(row: any): PayableWithInstallments {
  const installments = (row.payable_installments || []).map(mapInstallment).sort((a: PayableInstallment, b: PayableInstallment) => a.installmentNumber - b.installmentNumber);
  const status = aggregateStatus(installments, row.status || "open");
  const dueDate = installments.find((item: PayableInstallment) => item.status !== "paid")?.dueDate || row.due_date;
  const paidDate = installments.length && installments.every((item: PayableInstallment) => item.status === "paid")
    ? installments[installments.length - 1]?.paidDate
    : row.paid_date || undefined;
  return {
    id: row.id,
    supplierId: row.supplier_id || undefined,
    supplier: row.supplier || "",
    description: row.description || "",
    category: row.category || "",
    amount: Number(row.amount || 0),
    dueDate,
    status,
    paidDate,
    issueDate: row.issue_date || undefined,
    firstDueDate: row.first_due_date || row.due_date,
    installmentsCount: Number(row.installments_count || installments.length || 1),
    companyId: row.company_id || undefined,
    companyName: row.company_name || undefined,
    sourceNotes: row.source_notes || undefined,
    installments,
  };
}

function mapProfessional(row: any): Professional {
  return { id: row.id, name: row.name || "", specialty: row.specialty || "", commissionRate: Number(row.commission_rate || 0), phone: row.phone || "", email: row.email || "", active: Boolean(row.active) };
}

function mapCategory(row: any): FinancialCategory {
  return { id: row.id, name: row.name || "", type: row.type || "expense" };
}

function mapSupplier(row: any): Supplier {
  return {
    id: row.id,
    externalId: row.external_id || undefined,
    name: row.name || "",
    legalName: row.legal_name || "",
    cnpj: row.cnpj || row.document || "",
    document: row.document || row.cnpj || "",
    phone: row.phone || "",
    mobile: row.mobile || "",
    email: row.email || "",
    category: row.category || "",
    notes: row.notes || "",
    bank: row.bank || "",
    agency: row.agency || "",
    account: row.account || "",
  };
}

export default function FinancialPage() {
  const { clinic, user } = useClinic();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [payables, setPayables] = useState<PayableWithInstallments[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cashSession, setCashSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = usePersistentState(storageKeys.activeTab, "receivables");
  const [receivableFilter, setReceivableFilter] = usePersistentState(storageKeys.receivableFilter, "");
  const [receivableStart, setReceivableStart] = usePersistentState(storageKeys.receivableStart, "");
  const [receivableEnd, setReceivableEnd] = usePersistentState(storageKeys.receivableEnd, "");
  const [payableFilter, setPayableFilter] = usePersistentState(storageKeys.payableFilter, "");
  const [payableStart, setPayableStart] = usePersistentState(storageKeys.payableStart, "");
  const [payableEnd, setPayableEnd] = usePersistentState(storageKeys.payableEnd, "");
  const [cashFilter, setCashFilter] = usePersistentState(storageKeys.cashFilter, "");
  const [cashStart, setCashStart] = usePersistentState(storageKeys.cashStart, "");
  const [cashEnd, setCashEnd] = usePersistentState(storageKeys.cashEnd, "");

  const [showRecForm, setShowRecForm] = usePersistentState(storageKeys.showReceivableForm, false);
  const [editingRec, setEditingRec] = useState<Receivable | null>(null);
  const [recForm, setRecForm] = usePersistentState<ReceivableForm>(storageKeys.receivableDraft, emptyReceivable);
  const [deleteRecId, setDeleteRecId] = useState<string | null>(null);

  const [showPayForm, setShowPayForm] = usePersistentState(storageKeys.showPayableForm, false);
  const [editingPay, setEditingPay] = useState<PayableWithInstallments | null>(null);
  const [payForm, setPayForm] = usePersistentState<PayableForm>(storageKeys.payableDraft, { ...emptyPayable, installments: buildInstallments(0, 1, today()) });
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
    const [recRes, payRes, profRes, catRes, supplierRes, clientRes, procedureRes, cashRes] = await Promise.all([
      db.from("receivables").select("*").eq("clinic_id", clinic.id).order("due_date", { ascending: false }),
      db.from("payables").select("*, payable_installments(*)").eq("clinic_id", clinic.id).order("due_date", { ascending: false }),
      db.from("professionals").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("financial_categories").select("*").eq("clinic_id", clinic.id).order("type").order("name"),
      db.from("suppliers").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("patients").select("id, name, cpf").eq("clinic_id", clinic.id).order("name"),
      db.from("procedures").select("id, name, default_price, average_duration").eq("clinic_id", clinic.id).order("name"),
      db.from("cash_sessions").select("*").eq("clinic_id", clinic.id).is("closed_at", null).order("opened_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLoading(false);
    const error = recRes.error || payRes.error || profRes.error || catRes.error || supplierRes.error || clientRes.error || procedureRes.error || cashRes.error;
    if (error) return toast.error("Nao foi possivel carregar o financeiro. Verifique se a migration de parcelas foi aplicada.");
    setReceivables((recRes.data || []).map(mapReceivable));
    setPayables((payRes.data || []).map(mapPayable));
    setProfessionals((profRes.data || []).map(mapProfessional));
    setCategories((catRes.data || []).map(mapCategory));
    setSuppliers((supplierRes.data || []).map(mapSupplier));
    setClients((clientRes.data || []).map((client: any) => ({ id: client.id, name: client.name || "", cpf: client.cpf || "" })));
    setProcedures((procedureRes.data || []).map((procedure: any) => ({
      id: procedure.id,
      name: procedure.name || "",
      defaultPrice: Number(procedure.default_price || 0),
      averageDuration: Number(procedure.average_duration || 30),
    })));
    setCashSession(cashRes.data || null);
  };

  const incomeCategories = useMemo(() => categories.filter(c => c.type === "income"), [categories]);
  const expenseCategories = useMemo(() => categories.filter(c => c.type === "expense"), [categories]);
  const incomeCategoryOptions = useMemo(() => incomeCategories.map((category) => ({ id: category.id, label: category.name, description: "Receita" })), [incomeCategories]);
  const expenseCategoryOptions = useMemo(() => expenseCategories.map((category) => ({ id: category.id, label: category.name, description: "Despesa" })), [expenseCategories]);
  const clientOptions = useMemo(() => clients.map((client) => ({ id: client.id, label: client.name, description: client.cpf || undefined, search: client.cpf || "" })), [clients]);
  const procedureOptions = useMemo(() => procedures.map((procedure) => ({
    id: procedure.id,
    label: procedure.name,
    description: formatCurrency(procedure.defaultPrice),
    search: `${procedure.defaultPrice} ${procedure.averageDuration}`,
  })), [procedures]);
  const supplierOptions = useMemo(() => suppliers.map((supplier) => ({
    id: supplier.id,
    label: supplier.name,
    description: [supplier.legalName, supplier.document || supplier.cnpj].filter(Boolean).join(" - "),
    search: `${supplier.legalName || ""} ${supplier.document || ""} ${supplier.cnpj || ""}`,
  })), [suppliers]);

  const payableTotals = useMemo(() => {
    const allInstallments = payables.flatMap((payable) => payable.installments.length ? payable.installments : [{
      id: payable.id,
      payableId: payable.id,
      installmentNumber: 1,
      amount: payable.amount,
      dueDate: payable.dueDate,
      paidDate: payable.paidDate,
      paidAmount: payable.status === "paid" ? payable.amount : undefined,
      status: payable.status,
    }]);
    return {
      total: allInstallments.reduce((sum, item) => sum + item.amount, 0),
      paid: allInstallments.filter((item) => item.status === "paid").reduce((sum, item) => sum + (item.paidAmount ?? item.amount), 0),
      open: allInstallments.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.amount, 0),
      installments: allInstallments,
    };
  }, [payables]);

  const totals = useMemo(() => ({
    totalReceivables: receivables.filter(r => r.status !== "paid").reduce((a, b) => a + b.amount, 0),
    totalPaid: receivables.filter(r => r.status === "paid").reduce((a, b) => a + b.amount, 0),
    totalPayables: payableTotals.open,
    paidPayables: payableTotals.paid,
  }), [receivables, payableTotals]);

  const filteredReceivables = useMemo(() => {
    const term = normalizeText(receivableFilter);
    return receivables.filter((item) => {
      const text = normalizeText(`${item.patientName} ${item.procedure} ${item.professionalName} ${item.paymentMethod}`);
      return (!term || text.includes(term)) && isWithinPeriod(item.dueDate, receivableStart, receivableEnd);
    });
  }, [receivables, receivableFilter, receivableStart, receivableEnd]);

  const filteredPayables = useMemo(() => {
    const term = normalizeText(payableFilter);
    return payables.filter((item) => {
      const text = normalizeText(`${item.supplier} ${item.description} ${item.category} ${item.companyName || ""}`);
      return (!term || text.includes(term)) && isWithinPeriod(item.dueDate, payableStart, payableEnd);
    });
  }, [payables, payableFilter, payableStart, payableEnd]);

  const cashEntries = useMemo(() => {
    const income = receivables
      .filter((item) => item.status === "paid")
      .map((item) => ({
        id: `rec-${item.id}`,
        type: "income" as const,
        title: `${item.procedure} - ${item.patientName}`,
        subtitle: `${item.paymentMethod}${item.professionalName ? ` - ${item.professionalName}` : ""}`,
        date: item.paidDate || item.dueDate,
        amount: item.amount,
      }));
    const expenses = payableTotals.installments
      .filter((item) => item.status === "paid")
      .map((item) => {
        const payable = payables.find((pay) => pay.id === item.payableId);
        return {
          id: `pay-${item.id}`,
          type: "expense" as const,
          title: payable ? `${payable.supplier} - Parcela ${item.installmentNumber}` : `Parcela ${item.installmentNumber}`,
          subtitle: payable?.description || "",
          date: item.paidDate || item.dueDate,
          amount: item.paidAmount ?? item.amount,
        };
      });
    return [...income, ...expenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [receivables, payableTotals.installments, payables]);

  const filteredCashEntries = useMemo(() => {
    const term = normalizeText(cashFilter);
    return cashEntries.filter((item) => {
      const text = normalizeText(`${item.title} ${item.subtitle}`);
      return (!term || text.includes(term)) && isWithinPeriod(item.date, cashStart, cashEnd);
    });
  }, [cashEntries, cashFilter, cashStart, cashEnd]);

  const openRec = (rec?: Receivable) => {
    setEditingRec(rec || null);
    setRecForm(rec ? {
      patientName: rec.patientName,
      patientId: rec.patientId,
      professionalName: rec.professionalName,
      procedure: rec.procedure,
      category: rec.category || "",
      amount: rec.amount,
      paymentMethod: rec.paymentMethod || "Pix",
      installments: rec.installments,
      status: rec.status,
      dueDate: rec.dueDate,
      paidDate: rec.paidDate,
    } : (hasReceivableDraft(recForm) ? recForm : emptyReceivable));
    setShowRecForm(true);
  };

  const openPay = (pay?: PayableWithInstallments) => {
    setEditingPay(pay || null);
    const base = pay ? {
      supplierId: pay.supplierId,
      supplier: pay.supplier,
      description: pay.description,
      category: pay.category,
      amount: pay.amount,
      dueDate: pay.firstDueDate || pay.dueDate,
      status: pay.status,
      paidDate: pay.paidDate,
      issueDate: pay.issueDate,
      firstDueDate: pay.firstDueDate,
      installmentsCount: pay.installmentsCount || pay.installments.length || 1,
      companyId: pay.companyId,
      companyName: pay.companyName,
      sourceNotes: pay.sourceNotes,
      installments: pay.installments.length ? pay.installments.map(({ payableId, ...item }) => item) : buildInstallments(pay.amount, 1, pay.dueDate),
    } : (hasPayableDraft(payForm) ? payForm : { ...emptyPayable, installments: buildInstallments(0, 1, today()) });
    setPayForm(base);
    setShowPayForm(true);
  };

  const regeneratePayableInstallments = () => {
    setPayForm((prev) => ({ ...prev, installments: buildInstallments(prev.amount, prev.installmentsCount, prev.dueDate) }));
  };

  const updateInstallment = (index: number, changes: Partial<InstallmentForm>) => {
    setPayForm((prev) => {
      const installments = prev.installments.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item);
      const amount = installments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...prev, installments, amount, installmentsCount: installments.length };
    });
  };

  const removeInstallment = (index: number) => {
    setPayForm((prev) => {
      if (prev.installments.length <= 1) {
        toast.error("A conta precisa manter pelo menos uma parcela.");
        return prev;
      }
      const installments = prev.installments
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item, itemIndex) => ({ ...item, installmentNumber: itemIndex + 1 }));
      const amount = installments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...prev, installments, amount, installmentsCount: installments.length };
    });
  };

  const saveReceivable = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada. Verifique o cadastro da clinica atual.");
    const client = clients.find((item) => item.id === recForm.patientId);
    if (!client) return toast.error("Informe o cliente.");
    const payload = {
      clinic_id: clinic.id,
      patient_id: client.id,
      patient_name: client.name,
      professional_name: "",
      procedure_name: recForm.procedure.trim() || "Sem procedimento",
      category: recForm.category || null,
      amount: Number(recForm.amount || 0),
      payment_method: recForm.paymentMethod,
      installments: Number(recForm.installments || 1),
      status: recForm.status,
      due_date: recForm.dueDate,
      paid_date: recForm.status === "paid" ? (recForm.paidDate || today()) : null,
    };
    const query = editingRec
      ? db.from("receivables").update(payload).eq("id", editingRec.id).eq("clinic_id", clinic.id).select().single()
      : db.from("receivables").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Nao foi possivel salvar a conta a receber.");
    const saved = mapReceivable(data);
    setReceivables(prev => editingRec ? prev.map(r => r.id === saved.id ? saved : r) : [saved, ...prev]);
    toast.success(editingRec ? "Conta a receber atualizada" : "Conta a receber registrada");
    setShowRecForm(false);
    setEditingRec(null);
    setRecForm(emptyReceivable);
    clearPersistentState(storageKeys.receivableDraft);
    clearPersistentState(storageKeys.showReceivableForm);
  };

  const savePayable = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada. Verifique o cadastro da clinica atual.");
    if (!payForm.supplier.trim()) return toast.error("Informe o fornecedor.");
    const installments = payForm.installments.length ? payForm.installments : buildInstallments(payForm.amount, payForm.installmentsCount, payForm.dueDate);
    const aggregate = aggregateStatus(installments.map((item) => ({ ...item, payableId: editingPay?.id || "" })), payForm.status);
    const paidDate = aggregate === "paid" ? installments[installments.length - 1]?.paidDate || today() : null;
    const payload = {
      clinic_id: clinic.id,
      supplier_id: payForm.supplierId || null,
      supplier: payForm.supplier.trim(),
      description: payForm.description.trim() || "Sem descricao",
      category: payForm.category,
      amount: installments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      due_date: installments.find((item) => item.status !== "paid")?.dueDate || installments[0]?.dueDate || payForm.dueDate,
      status: aggregate,
      paid_date: paidDate,
      issue_date: payForm.issueDate || null,
      first_due_date: installments[0]?.dueDate || payForm.dueDate,
      installments_count: installments.length,
      company_id: payForm.companyId || null,
      company_name: payForm.companyName || null,
      source_notes: payForm.sourceNotes || null,
    };
    const query = editingPay
      ? db.from("payables").update(payload).eq("id", editingPay.id).eq("clinic_id", clinic.id).select().single()
      : db.from("payables").insert(payload).select().single();
    const { data, error } = await query;
    if (error) return toast.error("Nao foi possivel salvar a conta a pagar.");

    const payableId = data.id;
    const rows = installments.map((item) => ({
      clinic_id: clinic.id,
      payable_id: payableId,
      installment_number: Number(item.installmentNumber || 1),
      amount: Number(item.amount || 0),
      due_date: item.dueDate,
      paid_date: item.status === "paid" ? (item.paidDate || today()) : null,
      paid_amount: item.status === "paid" ? Number(item.paidAmount ?? item.amount ?? 0) : null,
      status: normalizeInstallmentStatus(item.status, item.dueDate),
      notes: item.notes || null,
    }));
    if (editingPay) {
      await db.from("payable_installments").delete().eq("payable_id", payableId).gt("installment_number", rows.length);
    }
    const { error: installmentError } = await db
      .from("payable_installments")
      .upsert(rows, { onConflict: "payable_id,installment_number" });
    if (installmentError) return toast.error("Conta salva, mas nao foi possivel atualizar as parcelas.");

    toast.success(editingPay ? "Conta a pagar atualizada" : "Conta a pagar registrada");
    setShowPayForm(false);
    setEditingPay(null);
    setPayForm({ ...emptyPayable, installments: buildInstallments(0, 1, today()) });
    clearPersistentState(storageKeys.payableDraft);
    clearPersistentState(storageKeys.showPayableForm);
    await loadData();
  };

  const deleteRecord = async (table: "receivables" | "payables", id: string) => {
    if (!clinic.id) return toast.error("Clinica nao vinculada. Verifique o cadastro da clinica atual.");
    const { error } = await db.from(table).delete().eq("id", id).eq("clinic_id", clinic.id);
    if (error) return toast.error("Nao foi possivel excluir o lancamento.");
    if (table === "receivables") {
      setReceivables(prev => prev.filter(r => r.id !== id));
      setDeleteRecId(null);
    } else {
      setPayables(prev => prev.filter(p => p.id !== id));
      setDeletePayId(null);
    }
    toast.success("Lancamento excluido com sucesso");
  };

  const updateReceivableStatus = async (receivable: Receivable, status: FinancialStatus) => {
    if (!clinic.id) return toast.error("Clinica nao vinculada. Verifique o cadastro da clinica atual.");
    const paidDate = status === "paid" ? (receivable.paidDate || today()) : null;
    const { error } = await db
      .from("receivables")
      .update({ status, paid_date: paidDate })
      .eq("id", receivable.id)
      .eq("clinic_id", clinic.id);
    if (error) return toast.error("Nao foi possivel atualizar o status.");
    setReceivables((prev) => prev.map((item) => item.id === receivable.id ? { ...item, status, paidDate: paidDate || undefined } : item));
    toast.success("Status atualizado.");
  };

  const updatePayableStatus = async (payable: PayableWithInstallments, status: FinancialStatus) => {
    if (!clinic.id) return toast.error("Clinica nao vinculada. Verifique o cadastro da clinica atual.");
    const paidDate = status === "paid" ? (payable.paidDate || today()) : null;
    const { error } = await db
      .from("payables")
      .update({ status, paid_date: paidDate })
      .eq("id", payable.id)
      .eq("clinic_id", clinic.id);
    if (error) return toast.error("Nao foi possivel atualizar o status.");

    let nextInstallments = payable.installments;
    if (payable.installments.length) {
      nextInstallments = payable.installments.map((installment) => ({
        ...installment,
        status,
        paidDate: paidDate || undefined,
        paidAmount: status === "paid" ? installment.amount : undefined,
      }));
      const rows = nextInstallments.map((installment) => ({
        clinic_id: clinic.id,
        payable_id: payable.id,
        installment_number: installment.installmentNumber,
        amount: installment.amount,
        due_date: installment.dueDate,
        paid_date: status === "paid" ? paidDate : null,
        paid_amount: status === "paid" ? installment.amount : null,
        status,
        notes: installment.notes || null,
      }));
      const { error: installmentError } = await db
        .from("payable_installments")
        .upsert(rows, { onConflict: "payable_id,installment_number" });
      if (installmentError) return toast.error("Status da conta atualizado, mas nao foi possivel atualizar as parcelas.");
    }

    setPayables((prev) => prev.map((item) => item.id === payable.id ? { ...item, status, paidDate: paidDate || undefined, installments: nextInstallments } : item));
    toast.success("Status atualizado.");
  };

  const openCash = async () => {
    if (!clinic.id) return toast.error("Clinica nao vinculada. Verifique o cadastro da clinica atual.");
    if (cashSession) return toast.error("Ja existe um caixa aberto.");
    const { data, error } = await db.from("cash_sessions").insert({
      clinic_id: clinic.id,
      opened_by: user?.id || null,
      opening_balance: totals.totalPaid - totals.paidPayables,
    }).select().single();
    if (error) return toast.error("Nao foi possivel abrir o caixa. Verifique se a migration cash_sessions foi aplicada.");
    setCashSession(data);
    toast.success("Caixa aberto com sucesso.");
  };

  const closeCash = async () => {
    if (!clinic.id || !cashSession) return toast.error("Nao ha caixa aberto.");
    const closingBalance = totals.totalPaid - totals.paidPayables;
    const { data, error } = await db.from("cash_sessions").update({
      closed_by: user?.id || null,
      closed_at: new Date().toISOString(),
      closing_balance: closingBalance,
    }).eq("id", cashSession.id).eq("clinic_id", clinic.id).select().single();
    if (error) return toast.error("Nao foi possivel fechar o caixa.");
    setCashSession(null);
    toast.success(`Caixa fechado com saldo de ${formatCurrency(Number(data.closing_balance || closingBalance))}.`);
  };

  return (
    <ClinicLayout title="Financeiro" subtitle="Contas a receber, contas a pagar e caixa">
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeTab === "payables" ? (
            <>
              <StatCard label="Contas a Pagar" value={totals.totalPayables} icon={ArrowDownCircle} tone="danger" />
              <StatCard label="Contas Pagas" value={totals.paidPayables} icon={DollarSign} tone="primary" />
            </>
          ) : activeTab === "cashflow" ? (
            <>
              <StatCard label="Entradas" value={totals.totalPaid} icon={ArrowUpCircle} tone="success" />
              <StatCard label="Saidas" value={totals.paidPayables} icon={ArrowDownCircle} tone="danger" />
            </>
          ) : (
            <>
              <StatCard label="Contas a Receber" value={totals.totalReceivables} icon={ArrowUpCircle} tone="success" />
              <StatCard label="Contas Recebidas" value={totals.totalPaid} icon={DollarSign} tone="primary" />
            </>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap"><TabsTrigger value="receivables">Contas a Receber</TabsTrigger><TabsTrigger value="payables">Contas a Pagar</TabsTrigger><TabsTrigger value="cashflow">Caixa</TabsTrigger></TabsList>

          <TabsContent value="receivables">
            <FinanceFilters searchLabel="Pesquisar cliente" search={receivableFilter} onSearch={setReceivableFilter} start={receivableStart} onStart={setReceivableStart} end={receivableEnd} onEnd={setReceivableEnd} />
            <FinanceTable title="Contas a Receber" onNew={() => openRec()} headers={["Cliente", "Procedimento", "Valor", "Pagamento", "Vencimento", "Status", "Acoes"]}>
              {loading ? <EmptyRow text="Carregando lancamentos..." span={7} /> : filteredReceivables.map(r => <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3 text-sm font-medium text-foreground">{r.patientName}</td><td className="p-3 text-sm text-muted-foreground">{r.procedure}</td><td className="p-3 text-sm font-semibold text-foreground text-right">{formatCurrency(r.amount)}</td><td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{r.paymentMethod}{r.installments > 1 ? ` (${r.installments}x)` : ""}</td><td className="p-3 text-sm text-muted-foreground">{new Date(r.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</td><td className="p-3"><StatusSelect value={r.status as FinancialStatus} onChange={(status) => updateReceivableStatus(r, status)} /></td><td className="p-3 text-right"><ActionButtons onEdit={() => openRec(r)} onDelete={() => setDeleteRecId(r.id)} /></td></tr>)}
              {!loading && filteredReceivables.length === 0 && <EmptyRow text="Nenhuma conta a receber encontrada." span={7} />}
            </FinanceTable>
          </TabsContent>

          <TabsContent value="payables">
            <FinanceFilters searchLabel="Pesquisar fornecedor" search={payableFilter} onSearch={setPayableFilter} start={payableStart} onStart={setPayableStart} end={payableEnd} onEnd={setPayableEnd} />
            <FinanceTable title="Contas a Pagar" onNew={() => openPay()} headers={["Fornecedor", "Descricao", "Parcelas", "Valor", "Proximo vencimento", "Status", "Acoes"]}>
              {loading ? <EmptyRow text="Carregando lancamentos..." span={7} /> : filteredPayables.map(p => {
                const paidCount = p.installments.filter(item => item.status === "paid").length;
                const count = p.installments.length || p.installmentsCount || 1;
                return <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30"><td className="p-3 text-sm font-medium text-foreground">{p.supplier}</td><td className="p-3 text-sm text-muted-foreground">{p.description}</td><td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{paidCount}/{count}</td><td className="p-3 text-sm font-semibold text-foreground text-right">{formatCurrency(p.amount)}</td><td className="p-3 text-sm text-muted-foreground">{new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</td><td className="p-3"><StatusSelect value={p.status as FinancialStatus} onChange={(status) => updatePayableStatus(p, status)} /></td><td className="p-3 text-right"><ActionButtons onEdit={() => openPay(p)} onDelete={() => setDeletePayId(p.id)} /></td></tr>;
              })}
              {!loading && filteredPayables.length === 0 && <EmptyRow text="Nenhuma conta a pagar encontrada." span={7} />}
            </FinanceTable>
          </TabsContent>

          <TabsContent value="cashflow"><Card className="p-5"><div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-semibold">Controle de Caixa</h3><p className="text-xs text-muted-foreground">{cashSession ? `Aberto desde ${new Date(cashSession.opened_at).toLocaleString("pt-BR")}` : "Nenhum caixa aberto"}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={openCash} disabled={!!cashSession}>Abrir Caixa</Button><Button size="sm" variant="destructive" onClick={closeCash} disabled={!cashSession}>Fechar Caixa</Button></div></div><FinanceFilters searchLabel="Pesquisar cliente ou fornecedor" search={cashFilter} onSearch={setCashFilter} start={cashStart} onStart={setCashStart} end={cashEnd} onEnd={setCashEnd} /><div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"><div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">Saldo Inicial</p><p className="text-lg font-bold text-foreground">{formatCurrency(Number(cashSession?.opening_balance || 0))}</p></div><div className="p-3 rounded-lg bg-success/10 text-center"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-lg font-bold text-success">{formatCurrency(totals.totalPaid)}</p></div><div className="p-3 rounded-lg bg-destructive/10 text-center"><p className="text-xs text-muted-foreground">Saidas</p><p className="text-lg font-bold text-destructive">{formatCurrency(totals.paidPayables)}</p></div><div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-xs text-muted-foreground">Saldo Final</p><p className="text-lg font-bold text-primary">{formatCurrency(totals.totalPaid - totals.paidPayables)}</p></div></div><div className="space-y-2">{filteredCashEntries.slice(0, 20).map(entry => <div key={entry.id} className={`flex justify-between items-center p-3 rounded border-l-2 ${entry.type === "income" ? "bg-success/5 border-success" : "bg-destructive/5 border-destructive"}`}><div><p className="text-sm font-medium text-foreground">{entry.title}</p><p className="text-xs text-muted-foreground">{new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR")}{entry.subtitle ? ` - ${entry.subtitle}` : ""}</p></div><p className={`text-sm font-semibold ${entry.type === "income" ? "text-success" : "text-destructive"}`}>{entry.type === "income" ? "+" : "-"} {formatCurrency(entry.amount)}</p></div>)}{filteredCashEntries.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum movimento encontrado.</div>}</div></Card></TabsContent>
        </Tabs>

        <Dialog open={showRecForm} onOpenChange={open => { setShowRecForm(open); if (!open) setEditingRec(null); }}><DialogContent><DialogHeader><DialogTitle>{editingRec ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 mt-2"><div className="col-span-2"><EntitySearchInput label="Cliente" value={recForm.patientName} options={clientOptions} placeholder="Digite para procurar cliente" onQueryChange={patientName => setRecForm({ ...recForm, patientName, patientId: "" })} onSelect={option => setRecForm({ ...recForm, patientId: option.id, patientName: option.label })} /></div><div className="col-span-2"><EntitySearchInput label="Procedimento" value={recForm.procedure} options={procedureOptions} allowCustom placeholder="Digite para procurar procedimento" onQueryChange={procedure => setRecForm({ ...recForm, procedure })} onSelect={option => setRecForm({ ...recForm, procedure: option.label })} /></div><div className="col-span-2"><EntitySearchInput label="Categoria" value={recForm.category || ""} options={incomeCategoryOptions} allowCustom placeholder="Digite para procurar categoria de receita" onQueryChange={category => setRecForm({ ...recForm, category })} onSelect={option => setRecForm({ ...recForm, category: option.label })} /></div><div><Label>Valor</Label><Input inputMode="numeric" value={formatCurrency(recForm.amount)} onChange={e => setRecForm({ ...recForm, amount: parseCurrencyInput(e.target.value) })} /></div><div><Label>Parcelas</Label><Input type="number" value={recForm.installments} onChange={e => setRecForm({ ...recForm, installments: Number(e.target.value) })} /></div><div><Label>Forma de Pagamento</Label><Select value={recForm.paymentMethod} onValueChange={paymentMethod => setRecForm({ ...recForm, paymentMethod })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select></div><div><Label>Vencimento</Label><Input type="date" value={recForm.dueDate} onChange={e => setRecForm({ ...recForm, dueDate: e.target.value })} /></div><div className="col-span-2"><Label>Status</Label><Select value={recForm.status} onValueChange={(status: "open" | "paid" | "overdue") => setRecForm({ ...recForm, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Aberto</SelectItem><SelectItem value="paid">Pago</SelectItem><SelectItem value="overdue">Atrasado</SelectItem></SelectContent></Select></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowRecForm(false)}>Cancelar</Button><Button onClick={saveReceivable}>{editingRec ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <Dialog open={showPayForm} onOpenChange={open => { setShowPayForm(open); if (!open) setEditingPay(null); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingPay ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 mt-2"><div className="col-span-2"><EntitySearchInput label="Fornecedor" value={payForm.supplier} options={supplierOptions} allowCustom placeholder="Digite para procurar fornecedor" onQueryChange={supplier => setPayForm({ ...payForm, supplier, supplierId: undefined })} onSelect={option => setPayForm({ ...payForm, supplierId: option.id, supplier: option.label })} /></div><div className="col-span-2"><Label>Descricao</Label><Input value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })} /></div><div><EntitySearchInput label="Categoria" value={payForm.category || ""} options={expenseCategoryOptions} allowCustom placeholder="Digite para procurar categoria de despesa" onQueryChange={category => setPayForm({ ...payForm, category })} onSelect={option => setPayForm({ ...payForm, category: option.label })} /></div><div><Label>Valor total</Label><Input inputMode="numeric" value={formatCurrency(payForm.amount)} onChange={e => setPayForm({ ...payForm, amount: parseCurrencyInput(e.target.value) })} /></div><div><Label>Primeiro vencimento</Label><Input type="date" value={payForm.dueDate} onChange={e => setPayForm({ ...payForm, dueDate: e.target.value })} /></div><div><Label>Quantidade de parcelas</Label><Input type="number" min={1} value={payForm.installmentsCount} onChange={e => setPayForm({ ...payForm, installmentsCount: Math.max(1, Number(e.target.value || 1)) })} /></div><div><Label>Data de emissao</Label><Input type="date" value={payForm.issueDate || ""} onChange={e => setPayForm({ ...payForm, issueDate: e.target.value })} /></div><div><Label>Empresa</Label><Input value={payForm.companyName || ""} onChange={e => setPayForm({ ...payForm, companyName: e.target.value })} /></div></div><div className="mt-5 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Parcelas</h3><p className="text-xs text-muted-foreground">Edite vencimento, valor e status de cada parcela.</p></div><Button type="button" variant="outline" size="sm" onClick={regeneratePayableInstallments}><CalendarDays className="h-3.5 w-3.5 mr-1" />Gerar parcelas</Button></div><div className="mt-3 overflow-x-auto rounded-md border border-border"><table className="w-full"><thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Parcela</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Vencimento</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Valor</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Status</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Pagamento</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Obs.</th><th className="w-12 p-3"><span className="sr-only">Excluir</span></th></tr></thead><tbody>{payForm.installments.map((installment, index) => <tr key={`${installment.id}-${installment.installmentNumber}`} className="border-b border-border/50"><td className="p-2 text-sm font-medium">{installment.installmentNumber}</td><td className="p-2"><Input type="date" value={installment.dueDate} onChange={e => updateInstallment(index, { dueDate: e.target.value, status: normalizeInstallmentStatus(installment.status, e.target.value) })} /></td><td className="p-2"><Input className="text-right" inputMode="numeric" value={formatCurrency(installment.amount)} onChange={e => updateInstallment(index, { amount: parseCurrencyInput(e.target.value) })} /></td><td className="p-2"><Select value={installment.status} onValueChange={(status: "open" | "paid" | "overdue") => updateInstallment(index, { status, paidDate: status === "paid" ? (installment.paidDate || today()) : undefined, paidAmount: status === "paid" ? (installment.paidAmount ?? installment.amount) : undefined })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Aberta</SelectItem><SelectItem value="paid">Paga</SelectItem><SelectItem value="overdue">Atrasada</SelectItem></SelectContent></Select></td><td className="p-2"><Input type="date" value={installment.paidDate || ""} disabled={installment.status !== "paid"} onChange={e => updateInstallment(index, { paidDate: e.target.value })} /></td><td className="p-2"><Input value={installment.notes || ""} onChange={e => updateInstallment(index, { notes: e.target.value })} /></td><td className="p-2 text-right"><Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeInstallment(index)}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody></table></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowPayForm(false)}>Cancelar</Button><Button onClick={savePayable}>{editingPay ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <ConfirmDialog open={!!deleteRecId} onOpenChange={() => setDeleteRecId(null)} title="Excluir Conta a Receber" description="Tem certeza que deseja excluir esta conta?" onConfirm={() => deleteRecId && deleteRecord("receivables", deleteRecId)} />
        <ConfirmDialog open={!!deletePayId} onOpenChange={() => setDeletePayId(null)} title="Excluir Conta a Pagar" description="Tem certeza que deseja excluir esta conta e suas parcelas?" onConfirm={() => deletePayId && deleteRecord("payables", deletePayId)} />
      </div>
    </ClinicLayout>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof DollarSign; tone: "success" | "primary" | "danger" }) {
  const toneClass = tone === "success" ? "bg-success/10 text-success" : tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
  return (
    <Card className="stat-card">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass}`}><Icon className="h-5 w-5" /></div>
        <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold text-foreground">{formatCurrency(value)}</p></div>
      </div>
    </Card>
  );
}

function FinanceFilters({ searchLabel, search, onSearch, start, onStart, end, onEnd }: { searchLabel: string; search: string; onSearch: (value: string) => void; start: string; onStart: (value: string) => void; end: string; onEnd: (value: string) => void }) {
  return (
    <Card className="p-3 mb-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-3">
        <div><Label>{searchLabel}</Label><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Digite para pesquisar" /></div>
        <div><Label>Data inicial</Label><Input type="date" value={start} onChange={(event) => onStart(event.target.value)} /></div>
        <div><Label>Data final</Label><Input type="date" value={end} onChange={(event) => onEnd(event.target.value)} /></div>
      </div>
    </Card>
  );
}

function FinanceTable({ title, onNew, headers, children }: { title: string; onNew: () => void; headers: string[]; children: ReactNode }) {
  return <Card className="overflow-hidden"><div className="p-4 border-b border-border flex justify-between items-center"><h3 className="text-sm font-semibold">{title}</h3><Button size="sm" onClick={onNew}><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-border bg-muted/50">{headers.map((h, i) => <th key={h} className={`${i === headers.length - 1 || h === "Valor" ? "text-right" : h === "Status" ? "text-center" : "text-left"} text-xs font-medium text-muted-foreground p-3 ${["Profissional", "Pagamento", "Categoria", "Parcelas"].includes(h) ? "hidden md:table-cell" : ""}`}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div></Card>;
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button></div>;
}

function StatusSelect({ value, onChange }: { value: FinancialStatus; onChange: (status: FinancialStatus) => void }) {
  return (
    <Select value={value} onValueChange={(status: FinancialStatus) => onChange(status)}>
      <SelectTrigger className={`h-8 min-w-[112px] border-0 text-xs font-medium ${statusBadge[value]}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Aberto</SelectItem>
        <SelectItem value="paid">Pago</SelectItem>
        <SelectItem value="overdue">Atrasado</SelectItem>
      </SelectContent>
    </Select>
  );
}

function EmptyRow({ text, span }: { text: string; span: number }) {
  return <tr><td colSpan={span} className="p-8 text-center text-sm text-muted-foreground">{text}</td></tr>;
}
