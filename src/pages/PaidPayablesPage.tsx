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

type Row = { id: string; paidDate: string; dueDate: string; company: string; supplier: string; description: string; category: string; parcel: string; account: string; amount: number; extra: number; total: number };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const br = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");
const ALL = "all";

export default function PaidPayablesPage() {
  const { clinic } = useClinic();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; code: number | null }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ companyId: ALL, supplierId: ALL, category: ALL, accountId: ALL, start: monthStart(), end: today() });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clinic.id) return;
    void Promise.all([
      db.from("companies").select("id,name").eq("clinic_id", clinic.id).order("name"),
      db.from("suppliers").select("id,name,code").eq("clinic_id", clinic.id).order("code"),
      db.from("financial_categories").select("name,type").eq("clinic_id", clinic.id).order("name"),
      db.from("bank_accounts").select("id,bank_name,account_number").eq("clinic_id", clinic.id).order("bank_name"),
    ]).then(([c, s, cat, a]) => {
      setCompanies(c.data || []); setSuppliers((s.data as any) || []);
      setCategories(((cat.data as any[]) || []).filter(x => x.type === "expense").map(x => x.name));
      setAccounts(((a.data as any[]) || []).map(x => ({ id: x.id, name: `${x.bank_name} ${x.account_number || ""}`.trim() })));
    });
  }, [clinic.id]);

  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  const accName = (id?: string | null) => accounts.find(a => a.id === id)?.name || "";

  const consult = async () => {
    setLoading(true);
    let q = db.from("payable_installments").select("id,amount,juros_multa,acrescimo,paid_date,due_date,installment_number,bank_account_id,payables!inner(description,category,supplier,supplier_id,company_id,company_name,installments_count,source_notes)")
      .eq("clinic_id", clinic.id).eq("status", "paid").gte("paid_date", f.start).lte("paid_date", f.end).order("paid_date");
    if (f.companyId !== ALL) q = q.eq("payables.company_id", f.companyId);
    if (f.supplierId !== ALL) q = q.eq("payables.supplier_id", f.supplierId);
    if (f.category !== ALL) q = q.eq("payables.category", f.category);
    if (f.accountId !== ALL) q = q.eq("bank_account_id", f.accountId);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error("Não foi possível consultar as contas pagas.");
    setRows(((data as any[]) || []).filter(x => !String(x.payables?.source_notes || "").startsWith("settlement_extra")).map(x => {
      const amount = Number(x.amount || 0), extra = Number(x.juros_multa || 0) + Number(x.acrescimo || 0);
      return { id: x.id, paidDate: x.paid_date, dueDate: x.due_date, company: x.payables?.company_name || "", supplier: x.payables?.supplier || "", description: x.payables?.description || "",
        category: x.payables?.category || "", parcel: `${x.installment_number || 1}/${x.payables?.installments_count || 1}`, account: accName(x.bank_account_id), amount, extra, total: amount + extra };
    }));
  };

  const totals = useMemo(() => (rows || []).reduce((t, r) => ({ amount: t.amount + r.amount, extra: t.extra + r.extra, total: t.total + r.total }), { amount: 0, extra: 0, total: 0 }), [rows]);
  const head = ["Pagamento", "Vencimento", "Credor", "Descrição", "Categoria", "Parcela", "Conta", "Valor", "Juros/Acrésc.", "Total pago"];
  const body = (r: Row) => [br(r.paidDate), br(r.dueDate), r.supplier, r.description, r.category, r.parcel, r.account, formatCurrency(r.amount), formatCurrency(r.extra), formatCurrency(r.total)];
  const companyLabel = f.companyId === ALL ? "Todas as empresas" : companies.find(c => c.id === f.companyId)?.name || "";

  const exportPdf = () => {
    if (!rows) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14); doc.text("Relatório de Contas Pagas", 14, 15);
    doc.setFontSize(9); doc.text(`${clinic.name} · ${companyLabel} · Pagamento de ${br(f.start)} a ${br(f.end)}`, 14, 21);
    autoTable(doc, { startY: 26, styles: { fontSize: 8 }, headStyles: { fillColor: [220, 220, 220], textColor: 20 }, alternateRowStyles: { fillColor: [247, 247, 247] },
      head: [head], body: rows.map(body), foot: [["Total", "", "", "", "", "", `${rows.length} títulos`, formatCurrency(totals.amount), formatCurrency(totals.extra), formatCurrency(totals.total)]],
      footStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" } });
    doc.save(`contas-pagas-${f.start}-${f.end}.pdf`);
  };
  const exportExcel = () => {
    if (!rows) return;
    const ws = XLSX.utils.aoa_to_sheet([["Relatório de Contas Pagas"], [`${clinic.name} · ${companyLabel}`], [`Pagamento: ${br(f.start)} a ${br(f.end)}`], [],
      ["Pagamento", "Vencimento", "Empresa", "Credor", "Descrição", "Categoria", "Parcela", "Conta", "Valor", "Juros/Acrésc.", "Total pago"],
      ...rows.map(r => [br(r.paidDate), br(r.dueDate), r.company, r.supplier, r.description, r.category, r.parcel, r.account, r.amount, r.extra, r.total]),
      ["Total", "", "", "", "", "", "", "", totals.amount, totals.extra, totals.total]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Contas Pagas"); XLSX.writeFile(wb, `contas-pagas-${f.start}-${f.end}.xlsx`);
  };

  const sel = (label: string, k: keyof typeof f, all: string, opts: { value: string; label: string }[]) => (
    <div className="space-y-1.5"><Label>{label}</Label>
      <Select value={f[k]} onValueChange={v => set(k, v)}><SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>{all}</SelectItem>{opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>);

  return (
    <ClinicLayout title="Contas Pagas" subtitle="Parcelas pagas no período, pela data de pagamento">
      <form className="saas-panel mb-6 grid grid-cols-1 gap-4 p-6 md:grid-cols-3" onSubmit={e => { e.preventDefault(); void consult(); }}>
        {sel("Empresa", "companyId", "Todas as empresas", companies.map(c => ({ value: c.id, label: c.name })))}
        {sel("Credor", "supplierId", "Todos os credores", suppliers.map(s => ({ value: s.id, label: `${s.code ?? ""} - ${s.name}` })))}
        {sel("Categoria", "category", "Todas as categorias", categories.map(c => ({ value: c, label: c })))}
        {sel("Conta", "accountId", "Todas as contas", accounts.map(a => ({ value: a.id, label: a.name })))}
        <div className="space-y-1.5"><Label>Pagamento de</Label><Input type="date" value={f.start} onChange={e => set("start", e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Até</Label><Input type="date" value={f.end} onChange={e => set("end", e.target.value)} /></div>
        <div className="flex flex-wrap gap-2 md:col-span-3">
          <Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? "Consultando..." : "Consultar"}</Button>
          <Button type="button" variant="outline" disabled={!rows?.length} onClick={exportPdf}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          <Button type="button" variant="outline" disabled={!rows?.length} onClick={exportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
        </div>
      </form>
      {rows && <>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="saas-panel p-4"><p className="text-xs text-muted-foreground">Total pago</p><p className="text-xl font-semibold text-destructive">{formatCurrency(totals.total)}</p></div>
          <div className="saas-panel p-4"><p className="text-xs text-muted-foreground">Juros e acréscimos</p><p className="text-xl font-semibold">{formatCurrency(totals.extra)}</p></div>
          <div className="saas-panel p-4"><p className="text-xs text-muted-foreground">Parcelas pagas</p><p className="text-xl font-semibold">{rows.length}</p></div>
        </div>
        <div className="saas-panel overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{head.map((h, i) => <th key={h} className={`p-3 ${i >= 7 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhuma conta paga no período.</td></tr> :
            rows.map(r => <tr key={r.id} className="border-t">{body(r).map((v, i) => <td key={i} className={`p-3 ${i >= 7 ? "text-right whitespace-nowrap" : ""}`}>{v}</td>)}</tr>)}</tbody>
        </table></div>
      </>}
    </ClinicLayout>
  );
}
