import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntitySearchInput, type EntitySearchOption } from "@/components/EntitySearchInput";
import { CashControl } from "@/components/CashControl";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { clearPersistentState, usePersistentState } from "@/hooks/usePersistentState";
import { db } from "@/lib/clinicCloud";
import { formatCurrency, parseCurrencyInput, onlyDigits } from "@/lib/utils";
import type { FinancialCategory, Payable, PayableInstallment, Professional, Receivable, Supplier } from "@/data/mockData";
import { toast } from "sonner";
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Plus, Edit2, Trash2, CalendarDays, CheckCircle2, Search } from "lucide-react";

type CompanyRow = { id: string; name: string; legalName: string; cnpj: string; active: boolean };
type BankAccountRow = { id: string; name: string; initialDate: string; initialBalance: number; active: boolean; companyId?: string; accountType: string };

type ReceivableForm = Omit<Receivable, "id" | "professionalId">;
type ClientOption = { id: string; name: string; cpf?: string };
type ProcedureOption = { companyId?: string; id: string; name: string; defaultPrice: number; averageDuration: number };
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
  open: "bg-primary/15 text-primary",
  paid: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
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
    bankAccountId: row.bank_account_id || undefined,
    companyId: row.company_id || undefined,
    companyName: row.company_name || undefined,
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
    bankAccountId: row.bank_account_id || undefined,
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

export default function FinancialPage({ section }: { section: "receivables" | "payables" | "cashflow" }) {
  const activeTab = section;
  const { clinic } = useClinic();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [payables, setPayables] = useState<PayableWithInstallments[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [receivableFilter, setReceivableFilter] = usePersistentState(storageKeys.receivableFilter, "");
  const [receivableStart, setReceivableStart] = usePersistentState(storageKeys.receivableStart, "");
  const [receivableEnd, setReceivableEnd] = usePersistentState(storageKeys.receivableEnd, "");
  const [payableFilter, setPayableFilter] = usePersistentState(storageKeys.payableFilter, "");
  const [payableStart, setPayableStart] = usePersistentState(storageKeys.payableStart, "");
  const [payableEnd, setPayableEnd] = usePersistentState(storageKeys.payableEnd, "");

  const [showRecForm, setShowRecForm] = usePersistentState(storageKeys.showReceivableForm, false);
  const [editingRec, setEditingRec] = useState<Receivable | null>(null);
  const [recForm, setRecForm] = usePersistentState<ReceivableForm>(storageKeys.receivableDraft, emptyReceivable);
  const [deleteRecId, setDeleteRecId] = useState<string | null>(null);

  const [showPayForm, setShowPayForm] = usePersistentState(storageKeys.showPayableForm, false);
  const [editingPay, setEditingPay] = useState<PayableWithInstallments | null>(null);
  const [payForm, setPayForm] = usePersistentState<PayableForm>(storageKeys.payableDraft, { ...emptyPayable, installments: buildInstallments(0, 1, today()) });
  const [deletePayId, setDeletePayId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([]);
  const [selectedRec, setSelectedRec] = useState<string[]>([]);
  const [selectedPay, setSelectedPay] = useState<string[]>([]);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleAccount, setSettleAccount] = useState("");
  const [settleDate, setSettleDate] = useState(today());
  const [settling, setSettling] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [recView, setRecView] = useState<"entries" | "installments">("entries");
  const [payView, setPayView] = useState<"entries" | "installments">("entries");

  useEffect(() => {
    if (!clinic.id) return;
    void db.from("companies").select("id, name, legal_name, cnpj, active").eq("clinic_id", clinic.id).order("name").then(({ data }) => {
      setCompanies((data || []).map((c: any) => ({ id: c.id, name: c.name, legalName: c.legal_name || "", cnpj: c.cnpj || "", active: c.active })));
    });
  }, [clinic.id]);
  const companyName = (id?: string, fallback?: string) => companies.find((c) => c.id === id)?.name || fallback || "-";
  const companyOptions = companies.map(c => ({ id: c.id, code: c.id.slice(0, 8).toUpperCase(), label: c.name, legalName: c.legalName, document: c.cnpj }));

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
    const [recRes, payRes, profRes, catRes, supplierRes, clientRes, procedureRes] = await Promise.all([
      db.from("receivables").select("*").eq("clinic_id", clinic.id).order("due_date", { ascending: false }),
      db.from("payables").select("*, payable_installments(*)").eq("clinic_id", clinic.id).order("due_date", { ascending: false }),
      db.from("professionals").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("financial_categories").select("*").eq("clinic_id", clinic.id).order("type").order("name"),
      db.from("suppliers").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("patients").select("id, name, cpf").eq("clinic_id", clinic.id).order("name"),
      db.from("procedures").select("id, name, default_price, average_duration, company_id").eq("clinic_id", clinic.id).order("name"),
    ]);
    const bankRes = await db.from("bank_accounts").select("*").eq("clinic_id", clinic.id).order("bank_name");
    setBankAccounts((bankRes.data || []).map((b: any) => ({ id: b.id, companyId: b.company_id || undefined, accountType: b.account_type, name: `${b.bank_name} · Ag ${b.agency} · CC ${b.account_number}`, initialDate: b.initial_date, initialBalance: Number(b.initial_balance || 0), active: Boolean(b.active) })));
    setLoading(false);
    const error = recRes.error || payRes.error || profRes.error || catRes.error || supplierRes.error || clientRes.error || procedureRes.error;
    if (error) return toast.error("Nao foi possivel carregar o financeiro. Verifique se a migration de parcelas foi aplicada.");
    setReceivables((recRes.data || []).map(mapReceivable));
    setPayables((payRes.data || []).map(mapPayable));
    setProfessionals((profRes.data || []).map(mapProfessional));
    setCategories((catRes.data || []).map(mapCategory));
    setSuppliers((supplierRes.data || []).map(mapSupplier));
    setClients((clientRes.data || []).map((client: any) => ({ id: client.id, name: client.name || "", cpf: client.cpf || "" })));
    setProcedures((procedureRes.data || []).map((procedure: any) => ({
      id: procedure.id,
      companyId: procedure.company_id || undefined,
      name: procedure.name || "",
      defaultPrice: Number(procedure.default_price || 0),
      averageDuration: Number(procedure.average_duration || 30),
    })));
  };

  const incomeCategories = useMemo(() => categories.filter(c => c.type === "income"), [categories]);
  const expenseCategories = useMemo(() => categories.filter(c => c.type === "expense"), [categories]);
  const incomeCategoryOptions = useMemo(() => incomeCategories.map((category) => ({ id: category.id, label: category.name, description: "Receita" })), [incomeCategories]);
  const expenseCategoryOptions = useMemo(() => expenseCategories.map((category) => ({ id: category.id, label: category.name, description: "Despesa" })), [expenseCategories]);
  const clientOptions = useMemo(() => clients.map((client, i) => ({ id: client.id, code: String(i + 1), label: client.name, document: client.cpf || "", description: client.cpf || undefined, search: client.cpf || "" })), [clients]);
  const procedureOptions = useMemo(() => procedures.filter(p => p.companyId === recForm.companyId).map((procedure) => ({
    id: procedure.id,
    label: procedure.name,
    description: formatCurrency(procedure.defaultPrice),
    search: `${procedure.defaultPrice} ${procedure.averageDuration}`,
  })), [procedures, recForm.companyId]);
  const supplierOptions = useMemo(() => suppliers.map((supplier, i) => ({
    id: supplier.id,
    code: String(i + 1),
    legalName: supplier.legalName || "",
    document: supplier.document || supplier.cnpj || "",
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

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);

  const filteredReceivables = useMemo(() => {
    const term = normalizeText(receivableFilter);
    const digits = onlyDigits(receivableFilter);
    return receivables.filter((item) => {
      const client = item.patientId ? clientById.get(item.patientId) : undefined;
      const text = normalizeText(`${item.patientName} ${item.procedure} ${item.professionalName} ${item.paymentMethod} ${client?.cpf || ""}`);
      const numeric = onlyDigits(client?.cpf || "");
      const matches = !term || text.includes(term) || (!!digits && numeric.includes(digits));
      return matches && isWithinPeriod(item.dueDate, receivableStart, receivableEnd);
    });
  }, [receivables, receivableFilter, receivableStart, receivableEnd, clientById]);

  const filteredPayables = useMemo(() => {
    const term = normalizeText(payableFilter);
    const digits = onlyDigits(payableFilter);
    return payables.filter((item) => {
      const supplier = item.supplierId ? supplierById.get(item.supplierId) : undefined;
      const text = normalizeText(`${item.supplier} ${item.description} ${item.category} ${item.companyName || ""} ${supplier?.legalName || ""} ${supplier?.document || ""} ${supplier?.cnpj || ""}`);
      const numeric = onlyDigits(`${supplier?.document || ""} ${supplier?.cnpj || ""}`);
      const matches = !term || text.includes(term) || (!!digits && numeric.includes(digits));
      return matches && isWithinPeriod(item.dueDate, payableStart, payableEnd);
    });
  }, [payables, payableFilter, payableStart, payableEnd, supplierById]);
  const receivableInstallments = useMemo(() => filteredReceivables.flatMap((r) => {
    const count = Math.max(1, r.installments || 1);
    const base = Math.floor((r.amount / count) * 100) / 100;
    return Array.from({ length: count }, (_, i) => ({
      key: `${r.id}-${i}`, rec: r, number: i + 1, count,
      amount: i === count - 1 ? Math.round((r.amount - base * (count - 1)) * 100) / 100 : base,
      dueDate: addMonths(r.dueDate, i),
    }));
  }), [filteredReceivables]);
  const payableInstallmentRows = useMemo(() => filteredPayables.flatMap((p) => (p.installments.length ? p.installments : []).map((inst) => ({ key: inst.id, pay: p, inst, count: p.installments.length }))), [filteredPayables]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const settleSelected = async () => {
    if (!clinic.id) return;
    if (!settleAccount) return toast.error("Selecione a conta corrente.");
    if (!settleDate) return toast.error("Informe a data da baixa.");
    const account = bankAccounts.find(a => a.id === settleAccount && a.active);
    const targets = section === "receivables" ? receivables.filter(r => selectedRec.includes(r.id)) : payables.filter(p => selectedPay.includes(p.id));
    if (!account?.companyId || targets.some(t => t.companyId !== account.companyId)) return toast.error("Selecione lançamentos e conta da mesma empresa.");
    if (settleDate < account.initialDate) return toast.error("A baixa não pode ser anterior à data inicial da conta.");
    setSettling(true);
    try {
      if (section === "receivables") {
        const ids = selectedRec.filter((id) => receivables.find((r) => r.id === id)?.status !== "paid");
        if (!ids.length) { toast.error("Os lancamentos selecionados ja estao baixados."); return; }
        const { error } = await db.from("receivables").update({ status: "paid", paid_date: settleDate, bank_account_id: settleAccount }).in("id", ids).eq("clinic_id", clinic.id);
        if (error) { toast.error("Nao foi possivel baixar os lancamentos."); return; }
        toast.success(`${ids.length} lancamento(s) baixado(s).`);
        setSelectedRec([]);
      } else {
        const targets = payables.filter((p) => selectedPay.includes(p.id));
        const installmentIds = targets.flatMap((p) => p.installments.filter((i) => i.status !== "paid").map((i) => i.id));
        for (const inst of targets.flatMap((p) => p.installments.filter((i) => i.status !== "paid"))) {
          const { error } = await db.from("payable_installments").update({ status: "paid", paid_date: settleDate, paid_amount: inst.amount, bank_account_id: settleAccount }).eq("id", inst.id).eq("clinic_id", clinic.id);
          if (error) { toast.error("Nao foi possivel baixar uma das parcelas."); return; }
        }
        const { error } = await db.from("payables").update({ status: "paid", paid_date: settleDate }).in("id", targets.map((p) => p.id)).eq("clinic_id", clinic.id);
        if (error) { toast.error("Nao foi possivel baixar os lancamentos."); return; }
        toast.success(`${targets.length} conta(s) baixada(s) (${installmentIds.length} parcela(s)).`);
        setSelectedPay([]);
      }
      setSettleOpen(false);
      await loadData();
    } finally {
      setSettling(false);
    }
  };

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
      bankAccountId: rec.bankAccountId,
      companyId: rec.companyId,
      companyName: rec.companyName,
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
    if (!recForm.companyId) return toast.error("Selecione a empresa do lançamento.");
    if (editingRec?.bankAccountId && editingRec.companyId !== recForm.companyId) return toast.error("Estorne a baixa antes de mudar a empresa.");
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
      company_id: recForm.companyId || null,
      company_name: companyName(recForm.companyId, recForm.companyName),
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
    if (!payForm.companyId) return toast.error("Selecione a empresa do lançamento.");
    if (editingPay?.installments.some(i => i.bankAccountId) && editingPay.companyId !== payForm.companyId) return toast.error("Estorne as baixas antes de mudar a empresa.");
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
      company_name: payForm.companyId ? companyName(payForm.companyId, payForm.companyName) : null,
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

  const recOnPage = recPage.pageItems.map(r => r.id);
  const payOnPage = payPage.pageItems.map(p => p.id);
  const sortHead = (label: string, key: string, sort: SortState, setSort: (s: SortState) => void, className = "") => (
    <th className={`cursor-pointer select-none whitespace-nowrap bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-muted ${className}`} onClick={() => setSort({ key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" })}>
      <span className="inline-flex items-center gap-1">{label}{sort.key === key ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</span>
    </th>
  );
  const plainHead = (label: string, className = "") => <th className={`whitespace-nowrap bg-muted/50 text-xs font-medium text-muted-foreground ${className}`}>{label}</th>;
  const selectionBar = (count: number, onClear: () => void) => count > 0 && <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{count} selecionado(s)</span><Button size="sm" variant="outline" onClick={onClear}>Limpar</Button><Button size="sm" onClick={() => { setSettleDate(today()); setSettleOpen(true); }}><CheckCircle2 className="mr-1 h-4 w-4" />Baixar</Button></div>;
  const fmtDate = (d?: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";

  return (
    <ClinicLayout title={section === "receivables" ? "Contas a Receber" : section === "payables" ? "Contas a Pagar" : "Controle de Caixa"} subtitle={section === "payables" ? "Gerenciamento de contas a pagar e parcelas" : section === "receivables" ? "Gerenciamento de contas a receber e parcelas" : "Financeiro · Virtuosa"}>
      <div className="animate-fade-in">
          {activeTab === "payables" && <>
            <FinanceFilterPanel value={payDraft} onChange={setPayDraft} onApply={() => setPayApplied(payDraft)} onClear={() => { setPayDraft(emptyFinanceFilters); setPayApplied(emptyFinanceFilters); }}
              companyOptions={companyOptions} entityLabel="Credor" entityOptions={supplierOptions} categoryOptions={expenseCategoryOptions}
              description="Refine a consulta por empresa, credor, categoria, status e período de vencimento" />
            <Tabs value={payView} onValueChange={v => setPayView(v as "entries" | "installments")} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList><TabsTrigger value="entries" className="px-4">Contas</TabsTrigger><TabsTrigger value="installments" className="px-4">Parcelas</TabsTrigger></TabsList>
                <div className="flex flex-wrap items-center gap-2">{selectionBar(selectedPay.length, () => setSelectedPay([]))}<Button size="sm" onClick={() => openPay()}><Plus className="mr-1 h-4 w-4" />Novo</Button></div>
              </div>
              <TabsContent value="entries" className="mt-0">
                <ResultsCard title="Contas a Pagar" count={filteredPayables.length} totals={payEntryTotals}>
                  <table className="w-full"><thead><tr>
                    <th className="w-10 bg-muted/50"><input type="checkbox" aria-label="Selecionar página" className="h-4 w-4 accent-primary" checked={payOnPage.length > 0 && payOnPage.every(id => selectedPay.includes(id))} onChange={e => setSelectedPay(e.target.checked ? Array.from(new Set([...selectedPay, ...payOnPage])) : selectedPay.filter(id => !payOnPage.includes(id)))} /></th>
                    {sortHead("Credor", "supplier", paySort, setPaySort)}{sortHead("Empresa", "company", paySort, setPaySort, "hidden lg:table-cell")}{sortHead("Categoria", "category", paySort, setPaySort, "hidden xl:table-cell")}{plainHead("Descrição", "hidden md:table-cell")}{plainHead("Parcela")}{sortHead("Valor", "amount", paySort, setPaySort, "text-right")}{sortHead("Vencimento", "dueDate", paySort, setPaySort)}{sortHead("Status", "status", paySort, setPaySort)}{plainHead("Ações", "text-right")}
                  </tr></thead><tbody>
                    {loading ? <EmptyRow text="Carregando lançamentos..." span={10} /> : payPage.pageItems.map(p => {
                      const paidCount = p.installments.filter(item => item.status === "paid").length;
                      const count = p.installments.length || p.installmentsCount || 1;
                      return <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td><input type="checkbox" aria-label="Selecionar" className="h-4 w-4 accent-primary" checked={selectedPay.includes(p.id)} onChange={() => toggle(selectedPay, setSelectedPay, p.id)} /></td>
                        <td className="font-medium text-foreground">{p.supplier}</td>
                        <td className="hidden text-muted-foreground lg:table-cell">{companyName(p.companyId, p.companyName)}</td>
                        <td className="hidden text-xs text-muted-foreground xl:table-cell">{p.category || "-"}</td>
                        <td className="hidden max-w-[260px] truncate text-xs uppercase text-muted-foreground md:table-cell" title={p.description}>{p.description}</td>
                        <td className="text-muted-foreground">{paidCount}/{count}</td>
                        <td className="whitespace-nowrap text-right font-semibold text-foreground">{formatCurrency(p.amount)}</td>
                        <td className="whitespace-nowrap text-muted-foreground">{fmtDate(p.dueDate)}</td>
                        <td><StatusSelect value={p.status as FinancialStatus} onChange={(status) => updatePayableStatus(p, status)} /></td>
                        <td className="text-right"><ActionButtons onEdit={() => openPay(p)} onDelete={() => setDeletePayId(p.id)} /></td>
                      </tr>;
                    })}
                    {!loading && filteredPayables.length === 0 && <EmptyRow text="Nenhuma conta encontrada" span={10} />}
                  </tbody></table>
                  <TablePagination {...payPage} />
                </ResultsCard>
              </TabsContent>
              <TabsContent value="installments" className="mt-0">
                <ResultsCard title="Parcelas a Pagar" count={payableInstallmentRows.length} totals={payInstTotals}>
                  <table className="w-full"><thead><tr>{plainHead("Credor")}{plainHead("Empresa", "hidden lg:table-cell")}{plainHead("Descrição", "hidden md:table-cell")}{plainHead("Parcela")}{plainHead("Valor", "text-right")}{plainHead("Vencimento")}{plainHead("Pagamento")}{plainHead("Status")}</tr></thead><tbody>
                    {payInstPage.pageItems.map(row => <tr key={row.key} className="border-b border-border/50 hover:bg-muted/30"><td className="font-medium text-foreground">{row.pay.supplier}</td><td className="hidden text-muted-foreground lg:table-cell">{companyName(row.pay.companyId, row.pay.companyName)}</td><td className="hidden max-w-[260px] truncate text-xs uppercase text-muted-foreground md:table-cell">{row.pay.description}</td><td className="text-muted-foreground">{row.inst.installmentNumber}/{row.count}</td><td className="whitespace-nowrap text-right font-semibold text-foreground">{formatCurrency(row.inst.amount)}</td><td className="whitespace-nowrap text-muted-foreground">{fmtDate(row.inst.dueDate)}</td><td className="whitespace-nowrap text-muted-foreground">{fmtDate(row.inst.paidDate)}</td><td><StatusPill status={row.inst.status} /></td></tr>)}
                    {!loading && payableInstallmentRows.length === 0 && <EmptyRow text="Nenhuma parcela encontrada" span={8} />}
                  </tbody></table>
                  <TablePagination {...payInstPage} />
                </ResultsCard>
              </TabsContent>
            </Tabs>
          </>}

          {activeTab === "receivables" && <>
            <FinanceFilterPanel value={recDraft} onChange={setRecDraft} onApply={() => setRecApplied(recDraft)} onClear={() => { setRecDraft(emptyFinanceFilters); setRecApplied(emptyFinanceFilters); }}
              companyOptions={companyOptions} entityLabel="Cliente" entityOptions={clientOptions} categoryOptions={incomeCategoryOptions}
              description="Refine a consulta por empresa, cliente, categoria, status e período de vencimento" />
            <Tabs value={recView} onValueChange={v => setRecView(v as "entries" | "installments")} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList><TabsTrigger value="entries" className="px-4">Contas</TabsTrigger><TabsTrigger value="installments" className="px-4">Parcelas</TabsTrigger></TabsList>
                <div className="flex flex-wrap items-center gap-2">{selectionBar(selectedRec.length, () => setSelectedRec([]))}<Button size="sm" onClick={() => openRec()}><Plus className="mr-1 h-4 w-4" />Novo</Button></div>
              </div>
              <TabsContent value="entries" className="mt-0">
                <ResultsCard title="Contas a Receber" count={filteredReceivables.length} totals={recEntryTotals}>
                  <table className="w-full"><thead><tr>
                    <th className="w-10 bg-muted/50"><input type="checkbox" aria-label="Selecionar página" className="h-4 w-4 accent-primary" checked={recOnPage.length > 0 && recOnPage.every(id => selectedRec.includes(id))} onChange={e => setSelectedRec(e.target.checked ? Array.from(new Set([...selectedRec, ...recOnPage])) : selectedRec.filter(id => !recOnPage.includes(id)))} /></th>
                    {sortHead("Cliente", "client", recSort, setRecSort)}{sortHead("Empresa", "company", recSort, setRecSort, "hidden lg:table-cell")}{sortHead("Procedimento", "procedure", recSort, setRecSort, "hidden md:table-cell")}{plainHead("Pagamento", "hidden xl:table-cell")}{sortHead("Valor", "amount", recSort, setRecSort, "text-right")}{sortHead("Vencimento", "dueDate", recSort, setRecSort)}{sortHead("Status", "status", recSort, setRecSort)}{plainHead("Ações", "text-right")}
                  </tr></thead><tbody>
                    {loading ? <EmptyRow text="Carregando lançamentos..." span={9} /> : recPage.pageItems.map(r => <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td><input type="checkbox" aria-label="Selecionar" className="h-4 w-4 accent-primary" checked={selectedRec.includes(r.id)} onChange={() => toggle(selectedRec, setSelectedRec, r.id)} /></td>
                      <td className="font-medium text-foreground">{r.patientName}</td>
                      <td className="hidden text-muted-foreground lg:table-cell">{companyName(r.companyId, r.companyName)}</td>
                      <td className="hidden text-muted-foreground md:table-cell">{r.procedure}</td>
                      <td className="hidden text-muted-foreground xl:table-cell">{r.paymentMethod}{r.installments > 1 ? ` (${r.installments}x)` : ""}</td>
                      <td className="whitespace-nowrap text-right font-semibold text-foreground">{formatCurrency(r.amount)}</td>
                      <td className="whitespace-nowrap text-muted-foreground">{fmtDate(r.dueDate)}</td>
                      <td><StatusSelect value={r.status as FinancialStatus} onChange={(status) => updateReceivableStatus(r, status)} /></td>
                      <td className="text-right"><ActionButtons onEdit={() => openRec(r)} onDelete={() => setDeleteRecId(r.id)} /></td>
                    </tr>)}
                    {!loading && filteredReceivables.length === 0 && <EmptyRow text="Nenhuma conta encontrada" span={9} />}
                  </tbody></table>
                  <TablePagination {...recPage} />
                </ResultsCard>
              </TabsContent>
              <TabsContent value="installments" className="mt-0">
                <ResultsCard title="Parcelas a Receber" count={receivableInstallments.length} totals={recInstTotals}>
                  <table className="w-full"><thead><tr>{plainHead("Cliente")}{plainHead("Empresa", "hidden lg:table-cell")}{plainHead("Procedimento", "hidden md:table-cell")}{plainHead("Parcela")}{plainHead("Valor", "text-right")}{plainHead("Vencimento")}{plainHead("Status")}</tr></thead><tbody>
                    {recInstPage.pageItems.map(row => <tr key={row.key} className="border-b border-border/50 hover:bg-muted/30"><td className="font-medium text-foreground">{row.rec.patientName}</td><td className="hidden text-muted-foreground lg:table-cell">{companyName(row.rec.companyId, row.rec.companyName)}</td><td className="hidden text-muted-foreground md:table-cell">{row.rec.procedure}</td><td className="text-muted-foreground">{row.number}/{row.count}</td><td className="whitespace-nowrap text-right font-semibold text-foreground">{formatCurrency(row.amount)}</td><td className="whitespace-nowrap text-muted-foreground">{fmtDate(row.dueDate)}</td><td><StatusPill status={row.rec.status} /></td></tr>)}
                    {!loading && receivableInstallments.length === 0 && <EmptyRow text="Nenhuma parcela encontrada" span={7} />}
                  </tbody></table>
                  <TablePagination {...recInstPage} />
                </ResultsCard>
              </TabsContent>
            </Tabs>
          </>}

          {activeTab === "cashflow" && <CashControl />}

        <Dialog open={showRecForm} onOpenChange={open => { setShowRecForm(open); if (!open) setEditingRec(null); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editingRec ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 mt-2"><div className="col-span-2"><EntitySearchInput advanced label="Empresa *" value={companies.find(c => c.id === recForm.companyId)?.name || ""} options={companyOptions.filter(o => companies.find(c => c.id === o.id)?.active || o.id === recForm.companyId)} placeholder="Selecione a empresa" onQueryChange={() => setRecForm({ ...recForm, companyId: undefined, companyName: "", procedure: "" })} onSelect={o => setRecForm({ ...recForm, companyId: o.id, companyName: o.label, procedure: "" })} /></div><div className="col-span-2"><EntitySearchInput advanced label="Cliente" value={recForm.patientName} options={clientOptions} placeholder="Digite para procurar cliente" onQueryChange={patientName => setRecForm({ ...recForm, patientName, patientId: "" })} onSelect={option => setRecForm({ ...recForm, patientId: option.id, patientName: option.label })} /></div><div className="col-span-2"><EntitySearchInput advanced label="Procedimento" value={recForm.procedure} options={procedureOptions} allowCustom placeholder="Digite para procurar procedimento" onQueryChange={procedure => setRecForm({ ...recForm, procedure })} onSelect={option => setRecForm({ ...recForm, procedure: option.label })} /></div><div className="col-span-2"><EntitySearchInput advanced label="Categoria" value={recForm.category || ""} options={incomeCategoryOptions} allowCustom placeholder="Digite para procurar categoria de receita" onQueryChange={category => setRecForm({ ...recForm, category })} onSelect={option => setRecForm({ ...recForm, category: option.label })} /></div><div><Label>Valor</Label><Input inputMode="numeric" value={formatCurrency(recForm.amount)} onChange={e => setRecForm({ ...recForm, amount: parseCurrencyInput(e.target.value) })} /></div><div><Label>Parcelas</Label><Input type="number" value={recForm.installments} onChange={e => setRecForm({ ...recForm, installments: Number(e.target.value) })} /></div><div><Label>Forma de Pagamento</Label><Select value={recForm.paymentMethod} onValueChange={paymentMethod => setRecForm({ ...recForm, paymentMethod })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentMethods.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select></div><div><Label>Vencimento</Label><Input type="date" value={recForm.dueDate} onChange={e => setRecForm({ ...recForm, dueDate: e.target.value })} /></div><div className="col-span-2"><Label>Status</Label><Select value={recForm.status} onValueChange={(status: "open" | "paid" | "overdue") => setRecForm({ ...recForm, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Aberto</SelectItem><SelectItem value="paid">Pago</SelectItem><SelectItem value="overdue">Atrasado</SelectItem></SelectContent></Select></div></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowRecForm(false)}>Cancelar</Button><Button onClick={saveReceivable}>{editingRec ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <Dialog open={showPayForm} onOpenChange={open => { setShowPayForm(open); if (!open) setEditingPay(null); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingPay ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 mt-2"><div className="col-span-2"><EntitySearchInput advanced label="Empresa *" value={companies.find(c => c.id === payForm.companyId)?.name || ""} options={companyOptions.filter(o => companies.find(c => c.id === o.id)?.active || o.id === payForm.companyId)} placeholder="Selecione a empresa" onQueryChange={() => setPayForm({ ...payForm, companyId: undefined, companyName: "" })} onSelect={o => setPayForm({ ...payForm, companyId: o.id, companyName: o.label })} /></div><div className="col-span-2"><EntitySearchInput advanced label="Credor" value={payForm.supplier} options={supplierOptions} allowCustom placeholder="Digite para procurar credor" onQueryChange={supplier => setPayForm({ ...payForm, supplier, supplierId: undefined })} onSelect={option => setPayForm({ ...payForm, supplierId: option.id, supplier: option.label })} /></div><div className="col-span-2"><Label>Descricao</Label><Input value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })} /></div><div><EntitySearchInput advanced label="Categoria" value={payForm.category || ""} options={expenseCategoryOptions} allowCustom placeholder="Digite para procurar categoria de despesa" onQueryChange={category => setPayForm({ ...payForm, category })} onSelect={option => setPayForm({ ...payForm, category: option.label })} /></div><div><Label>Valor total</Label><Input inputMode="numeric" value={formatCurrency(payForm.amount)} onChange={e => setPayForm({ ...payForm, amount: parseCurrencyInput(e.target.value) })} /></div><div><Label>Primeiro vencimento</Label><Input type="date" value={payForm.dueDate} onChange={e => setPayForm({ ...payForm, dueDate: e.target.value })} /></div><div><Label>Quantidade de parcelas</Label><Input type="number" min={1} value={payForm.installmentsCount} onChange={e => setPayForm({ ...payForm, installmentsCount: Math.max(1, Number(e.target.value || 1)) })} /></div><div><Label>Data de emissao</Label><Input type="date" value={payForm.issueDate || ""} onChange={e => setPayForm({ ...payForm, issueDate: e.target.value })} /></div></div><div className="mt-5 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Parcelas</h3><p className="text-xs text-muted-foreground">Edite vencimento, valor e status de cada parcela.</p></div><Button type="button" variant="outline" size="sm" onClick={regeneratePayableInstallments}><CalendarDays className="h-3.5 w-3.5 mr-1" />Gerar parcelas</Button></div><div className="mt-3 overflow-x-auto rounded-md border border-border"><table className="w-full"><thead><tr className="border-b border-border bg-muted/50"><th className="text-left text-xs font-medium text-muted-foreground p-3">Parcela</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Vencimento</th><th className="text-right text-xs font-medium text-muted-foreground p-3">Valor</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Status</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Pagamento</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Obs.</th><th className="w-12 p-3"><span className="sr-only">Excluir</span></th></tr></thead><tbody>{payForm.installments.map((installment, index) => <tr key={`${installment.id}-${installment.installmentNumber}`} className="border-b border-border/50"><td className="p-2 text-sm font-medium">{installment.installmentNumber}</td><td className="p-2"><Input type="date" value={installment.dueDate} onChange={e => updateInstallment(index, { dueDate: e.target.value, status: normalizeInstallmentStatus(installment.status, e.target.value) })} /></td><td className="p-2"><Input className="text-right" inputMode="numeric" value={formatCurrency(installment.amount)} onChange={e => updateInstallment(index, { amount: parseCurrencyInput(e.target.value) })} /></td><td className="p-2"><Select value={installment.status} onValueChange={(status: "open" | "paid" | "overdue") => updateInstallment(index, { status, paidDate: status === "paid" ? (installment.paidDate || today()) : undefined, paidAmount: status === "paid" ? (installment.paidAmount ?? installment.amount) : undefined })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Aberta</SelectItem><SelectItem value="paid">Paga</SelectItem><SelectItem value="overdue">Atrasada</SelectItem></SelectContent></Select></td><td className="p-2"><Input type="date" value={installment.paidDate || ""} disabled={installment.status !== "paid"} onChange={e => updateInstallment(index, { paidDate: e.target.value })} /></td><td className="p-2"><Input value={installment.notes || ""} onChange={e => updateInstallment(index, { notes: e.target.value })} /></td><td className="p-2 text-right"><Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeInstallment(index)}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>)}</tbody></table></div><div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowPayForm(false)}>Cancelar</Button><Button onClick={savePayable}>{editingPay ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog>

        <ConfirmDialog open={!!deleteRecId} onOpenChange={() => setDeleteRecId(null)} title="Excluir Conta a Receber" description="Tem certeza que deseja excluir esta conta?" onConfirm={() => deleteRecId && deleteRecord("receivables", deleteRecId)} />
        <ConfirmDialog open={!!deletePayId} onOpenChange={() => setDeletePayId(null)} title="Excluir Conta a Pagar" description="Tem certeza que deseja excluir esta conta e suas parcelas?" onConfirm={() => deletePayId && deleteRecord("payables", deletePayId)} />
      </div>
    <Dialog open={settleOpen} onOpenChange={setSettleOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Baixar lancamentos</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">{section === "receivables" ? selectedRec.length : selectedPay.length} lancamento(s) selecionado(s)</p><div className="space-y-1.5"><Label>Conta corrente</Label><Select value={settleAccount} onValueChange={setSettleAccount}><SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{bankAccounts.filter(a => a.active && a.companyId && (section === "receivables" ? receivables.filter(r => selectedRec.includes(r.id)).every(r => r.companyId === a.companyId) : payables.filter(p => selectedPay.includes(p.id)).every(p => p.companyId === a.companyId))).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>{bankAccounts.length === 0 && <p className="text-xs text-muted-foreground">Cadastre uma conta em Cadastros › Contas Correntes.</p>}</div><div className="space-y-1.5"><Label>Data da baixa</Label><Input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSettleOpen(false)}>Cancelar</Button><Button onClick={settleSelected} disabled={settling}>{settling ? "Baixando..." : "Baixar"}</Button></div></div></DialogContent></Dialog>
    </ClinicLayout>
  );
}

type Totals = { total: number; open: number; paid: number };

function ResultsCard({ title, count, totals, children }: { title: string; count: number; totals: Totals; children: ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-lg border-border/50 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{count} item(ns) encontrados</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="text-muted-foreground">Total <strong className="ml-1 text-foreground">{formatCurrency(totals.total)}</strong></span>
          <span className="text-muted-foreground">Em aberto <strong className="ml-1 text-destructive">{formatCurrency(totals.open)}</strong></span>
          <span className="text-muted-foreground">Pago <strong className="ml-1 text-success">{formatCurrency(totals.paid)}</strong></span>
        </div>
      </div>
      <div className="overflow-auto">{children}</div>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${statusBadge[status]}`}>{statusLabel[status]}</span>;
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button></div>;
}

function StatusSelect({ value, onChange }: { value: FinancialStatus; onChange: (status: FinancialStatus) => void }) {
  return (
    <Select value={value} onValueChange={(status: FinancialStatus) => onChange(status)}>
      <SelectTrigger className={`h-7 w-[108px] rounded-md border-transparent px-2.5 text-[11px] font-semibold shadow-none [&>svg]:text-current ${statusBadge[value]}`}>
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
