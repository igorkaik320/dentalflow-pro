import { useEffect, useState } from "react";
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

type Line = { category: string; amount: number };
type Report = { income: Line[]; expense: Line[]; totalIncome: number; totalExpense: number; result: number };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const br = (d: string) => d.split("-").reverse().join("/");
const NONE = "Sem classe financeira";

export default function DrePage() {
  const { clinic } = useClinic();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState("all");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clinic.id) return;
    void db.from("companies").select("id,name").eq("clinic_id", clinic.id).order("name").then(({ data }) => setCompanies(data || []));
  }, [clinic.id]);

  const consult = async () => {
    setLoading(true);
    let rec = db.from("receivables").select("amount,category,company_id").eq("clinic_id", clinic.id).eq("status", "paid").gte("paid_date", start).lte("paid_date", end);
    let pay = db.from("payable_installments").select("amount,juros_multa,acrescimo,payables!inner(category,company_id,source_notes)").eq("clinic_id", clinic.id).eq("status", "paid").gte("paid_date", start).lte("paid_date", end);
    let cash = db.from("cash_movements").select("amount,type,category,company_id").eq("clinic_id", clinic.id).gte("movement_date", start).lte("movement_date", end);
    if (companyId !== "all") { rec = rec.eq("company_id", companyId); pay = pay.eq("payables.company_id", companyId); cash = cash.eq("company_id", companyId); }
    const [r, p, c] = await Promise.all([rec, pay, cash]);
    setLoading(false);
    if (r.error || p.error || c.error) return toast.error("Não foi possível gerar o DRE.");
    const inc = new Map<string, number>(), exp = new Map<string, number>();
    const add = (m: Map<string, number>, k: string | null, v: number) => { if (v) m.set(k || NONE, (m.get(k || NONE) || 0) + v); };
    (r.data || []).forEach((x: any) => add(inc, x.category, Number(x.amount)));
    (p.data || []).forEach((x: any) => {
      // Lançamentos antigos gerados automaticamente de juros já estão na parcela de origem.
      if (String(x.payables?.source_notes || "").startsWith("settlement_extra")) return;
      add(exp, x.payables?.category, Number(x.amount));
      add(exp, "Juros", Number(x.juros_multa || 0));
      add(exp, "Acréscimos", Number(x.acrescimo || 0));
    });
    (c.data || []).forEach((x: any) => add(x.type === "income" ? inc : exp, x.category, Number(x.amount)));
    const lines = (m: Map<string, number>) => [...m].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    const income = lines(inc), expense = lines(exp);
    const totalIncome = income.reduce((s, l) => s + l.amount, 0), totalExpense = expense.reduce((s, l) => s + l.amount, 0);
    setReport({ income, expense, totalIncome, totalExpense, result: totalIncome - totalExpense });
  };

  const companyLabel = companyId === "all" ? "Todas as empresas" : companies.find(c => c.id === companyId)?.name || "";
  const pct = (v: number) => report?.totalIncome ? `${((v / report.totalIncome) * 100).toFixed(1)}%` : "-";
  const rows = (r: Report) => [
    ["RECEITAS", formatCurrency(r.totalIncome), pct(r.totalIncome)],
    ...r.income.map(l => [`   ${l.category}`, formatCurrency(l.amount), pct(l.amount)]),
    ["DESPESAS", formatCurrency(r.totalExpense), pct(r.totalExpense)],
    ...r.expense.map(l => [`   ${l.category}`, formatCurrency(l.amount), pct(l.amount)]),
    ["RESULTADO", formatCurrency(r.result), pct(r.result)],
  ];

  const exportPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text("DRE - Demonstrativo de Resultado", 14, 15);
    doc.setFontSize(9); doc.text(`${clinic.name} · ${companyLabel} · ${br(start)} a ${br(end)}`, 14, 21);
    autoTable(doc, { startY: 26, styles: { fontSize: 9 }, headStyles: { fillColor: [220, 220, 220], textColor: 20 }, head: [["Classe financeira", "Valor", "% Receita"]], body: rows(report),
      didParseCell: d => { if (d.section === "body" && !String(d.row.raw && (d.row.raw as string[])[0]).startsWith(" ")) d.cell.styles.fontStyle = "bold"; } });
    doc.save(`dre-${start}-${end}.pdf`);
  };
  const exportExcel = () => {
    if (!report) return;
    const ws = XLSX.utils.aoa_to_sheet([["DRE"], [`${clinic.name} · ${companyLabel}`], [`Período: ${br(start)} a ${br(end)}`], [], ["Classe financeira", "Valor", "% Receita"], ...rows(report)]);
    ws["!cols"] = [{ wch: 40 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DRE"); XLSX.writeFile(wb, `dre-${start}-${end}.xlsx`);
  };

  const Section = ({ title, lines, total, tone }: { title: string; lines: Line[]; total: number; tone: string }) => <>
    <tr className="border-t bg-muted/40 font-semibold"><td className="p-3">{title}</td><td className={`p-3 text-right ${tone}`}>{formatCurrency(total)}</td><td className="p-3 text-right">{pct(total)}</td></tr>
    {lines.length === 0 ? <tr className="border-t"><td colSpan={3} className="p-3 pl-8 text-muted-foreground">Nenhum valor no período.</td></tr> : lines.map(l => <tr key={l.category} className="border-t"><td className="p-3 pl-8">{l.category}</td><td className="p-3 text-right">{formatCurrency(l.amount)}</td><td className="p-3 text-right text-muted-foreground">{pct(l.amount)}</td></tr>)}
  </>;

  return (
    <ClinicLayout title="DRE" subtitle="Receitas e despesas por classe financeira (pelas datas de pagamento)">
      <form className="saas-panel mb-6 grid grid-cols-1 gap-4 p-6 md:grid-cols-4" onSubmit={e => { e.preventDefault(); void consult(); }}>
        <div className="space-y-1.5"><Label>Empresa</Label>
          <Select value={companyId} onValueChange={v => { setCompanyId(v); setReport(null); }}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as empresas</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Data Início</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Data Fim</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? "Gerando..." : "Consultar"}</Button>
          <Button type="button" variant="outline" disabled={!report} onClick={exportPdf}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          <Button type="button" variant="outline" disabled={!report} onClick={exportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
        </div>
      </form>
      {report && <div className="saas-panel overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Classe financeira</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">% Receita</th></tr></thead>
        <tbody>
          <Section title="Receitas" lines={report.income} total={report.totalIncome} tone="text-success" />
          <Section title="Despesas" lines={report.expense} total={report.totalExpense} tone="text-destructive" />
          <tr className="border-t-2 font-bold"><td className="p-3">Resultado</td><td className={`p-3 text-right ${report.result >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(report.result)}</td><td className="p-3 text-right">{pct(report.result)}</td></tr>
        </tbody></table></div>}
    </ClinicLayout>
  );
}
