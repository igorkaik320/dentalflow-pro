import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { FileSpreadsheet, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency } from "@/lib/utils";

type Account = { id: string; company_id: string | null; bank_name: string; agency: string; account_number: string; account_type: string; initial_date: string; initial_balance: number };
type Entry = { id: string; type: "income" | "expense"; date: string; description: string; party: string; source: string; amount: number };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const br = (d: string) => d ? d.split("-").reverse().join("/") : "";

export default function AccountStatementPage() {
  const { clinic } = useClinic();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [type, setType] = useState<"all" | "income" | "expense">("all");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const account = accounts.find(a => a.id === accountId);
  const company = companies.find(c => c.id === companyId);

  useEffect(() => {
    if (!clinic.id) return;
    void Promise.all([
      db.from("companies").select("id,name").eq("clinic_id", clinic.id).eq("active", true).order("name"),
      db.from("bank_accounts").select("*").eq("clinic_id", clinic.id).order("bank_name"),
    ]).then(([c, a]) => {
      if (c.error || a.error) return toast.error("Não foi possível carregar as contas.");
      setCompanies(c.data || []); setAccounts(a.data || []);
    });
  }, [clinic.id]);

  const consult = async () => {
    if (!account || !companyId) return toast.error("Selecione a empresa e a conta.");
    setLoading(true);
    const [manual, rec, pay] = await Promise.all([
      db.from("cash_movements").select("*").eq("clinic_id", clinic.id).eq("bank_account_id", account.id),
      db.from("receivables").select("*").eq("clinic_id", clinic.id).eq("bank_account_id", account.id).eq("status", "paid"),
      db.from("payable_installments").select("*, payables!inner(description,supplier)").eq("clinic_id", clinic.id).eq("bank_account_id", account.id).eq("status", "paid"),
    ]);
    setLoading(false);
    if (manual.error || rec.error || pay.error) return toast.error("Não foi possível carregar o extrato.");
    setEntries([
      ...(manual.data || []).map((m: any) => ({ id: m.id, type: m.type, date: m.movement_date, description: m.description, party: m.supplier_name || "", source: m.category || "Lançamento de caixa", amount: Number(m.amount) })),
      ...(rec.data || []).map((r: any) => ({ id: `r${r.id}`, type: "income" as const, date: r.paid_date, description: r.procedure_name, party: r.patient_name, source: "Contas a Receber", amount: Number(r.amount) })),
      ...(pay.data || []).map((p: any) => ({ id: `p${p.id}`, type: "expense" as const, date: p.paid_date, description: `${p.payables.description} · ${p.installment_number}ª parcela`, party: p.payables.supplier, source: "Contas a Pagar", amount: Number(p.paid_amount ?? p.amount) })),
    ].filter(e => e.date && e.date >= account.initial_date).sort((a, b) => a.date.localeCompare(b.date)));
  };

  const report = useMemo(() => {
    if (!entries || !account) return null;
    const signed = (e: Entry) => e.type === "income" ? e.amount : -e.amount;
    const previous = Number(account.initial_balance) + entries.filter(e => start && e.date < start).reduce((s, e) => s + signed(e), 0);
    let running = previous;
    const rows = entries.filter(e => (!start || e.date >= start) && (!end || e.date <= end)).map(e => ({ ...e, balance: (running += signed(e)) })).filter(e => type === "all" || e.type === type);
    const income = rows.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const expense = rows.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);
    return { previous, rows, income, expense, final: running };
  }, [entries, account, start, end, type]);

  const accountLabel = account ? `${account.bank_name} · Ag ${account.agency} · Cc ${account.account_number}` : "";
  const period = `${br(start) || "início"} a ${br(end) || "hoje"}`;

  const exportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text("Extrato de Conta", 14, 15);
    doc.setFontSize(9);
    doc.text(`${clinic.name} · ${company?.name || ""}`, 14, 21);
    doc.text(`Conta: ${accountLabel}   Período: ${period}`, 14, 26);
    doc.text(`Saldo anterior: ${formatCurrency(report.previous)}`, 14, 31);
    autoTable(doc, {
      startY: 35, styles: { fontSize: 8 }, headStyles: { fillColor: [220, 220, 220], textColor: 20 },
      head: [["Data", "Descrição", "Cliente/Credor", "Origem", "Entrada", "Saída", "Saldo"]],
      body: report.rows.map(r => [br(r.date), r.description, r.party, r.source, r.type === "income" ? formatCurrency(r.amount) : "", r.type === "expense" ? formatCurrency(r.amount) : "", formatCurrency(r.balance)]),
      foot: [["", "Totais", "", "", formatCurrency(report.income), formatCurrency(report.expense), formatCurrency(report.final)]],
      footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    });
    doc.save(`extrato-${start}-${end}.pdf`);
  };

  const exportExcel = () => {
    if (!report) return;
    const data = [
      ["Extrato de Conta"], [`${clinic.name} · ${company?.name || ""}`], [`Conta: ${accountLabel}`], [`Período: ${period}`], [],
      ["Data", "Descrição", "Cliente/Credor", "Origem", "Entrada", "Saída", "Saldo"],
      ["", "Saldo anterior", "", "", "", "", report.previous],
      ...report.rows.map(r => [br(r.date), r.description, r.party, r.source, r.type === "income" ? r.amount : "", r.type === "expense" ? r.amount : "", r.balance]),
      ["", "Totais", "", "", report.income, report.expense, report.final],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Extrato");
    XLSX.writeFile(wb, `extrato-${start}-${end}.xlsx`);
  };

  return (
    <ClinicLayout title="Extrato de Conta" subtitle="Entradas, saídas e saldo por conta corrente">
      <form className="saas-panel mb-6 grid grid-cols-1 gap-4 p-6 md:grid-cols-3 lg:grid-cols-6" onSubmit={e => { e.preventDefault(); void consult(); }}>
        <div className="space-y-1.5 lg:col-span-2"><Label>Empresa</Label>
          <Select value={companyId} onValueChange={v => { setCompanyId(v); setAccountId(""); setEntries(null); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5 lg:col-span-2"><Label>Conta</Label>
          <Select value={accountId} onValueChange={v => { setAccountId(v); setEntries(null); }} disabled={!companyId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{accounts.filter(a => a.company_id === companyId).map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_number}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5 lg:col-span-2"><Label>Tipo</Label>
          <Select value={type} onValueChange={v => setType(v as typeof type)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Entradas e saídas</SelectItem><SelectItem value="income">Somente entradas</SelectItem><SelectItem value="expense">Somente saídas</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Data Início</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Data Fim</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        <div className="flex items-end gap-2 md:col-span-3 lg:col-span-4">
          <Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? "Consultando..." : "Consultar"}</Button>
          <Button type="button" variant="outline" disabled={!report} onClick={exportPdf}><FileText className="mr-2 h-4 w-4" />Relatório PDF</Button>
          <Button type="button" variant="outline" disabled={!report} onClick={exportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
        </div>
      </form>

      {report && <>
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Saldo anterior", report.previous, ""], ["Entradas", report.income, "text-success"], ["Saídas", report.expense, "text-destructive"], ["Saldo final", report.final, ""]].map(([l, v, c]) =>
            <div key={l as string} className="saas-panel p-4"><p className="text-xs text-muted-foreground">{l}</p><p className={`mt-1 text-lg font-bold ${c}`}>{formatCurrency(v as number)}</p></div>)}
        </div>
        <div className="saas-panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3">Cliente/Credor</th><th className="p-3">Origem</th><th className="p-3 text-right">Entrada</th><th className="p-3 text-right">Saída</th><th className="p-3 text-right">Saldo</th></tr></thead>
            <tbody>
              {report.rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum movimento no período.</td></tr> : report.rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{br(r.date)}</td><td className="p-3">{r.description}</td><td className="p-3">{r.party}</td><td className="p-3 text-muted-foreground">{r.source}</td>
                  <td className="p-3 text-right text-success">{r.type === "income" ? formatCurrency(r.amount) : ""}</td>
                  <td className="p-3 text-right text-destructive">{r.type === "expense" ? formatCurrency(r.amount) : ""}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(r.balance)}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </>}
    </ClinicLayout>
  );
}
