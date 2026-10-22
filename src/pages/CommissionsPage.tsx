import { useEffect, useState } from "react";
import { Calculator, Search, FileCheck2, List } from "lucide-react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EntitySearchInput, type EntitySearchOption } from "@/components/EntitySearchInput";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommissionAdjustments, CommissionRules } from "@/components/CommissionExtras";

type Detail = { id: string; patient: string; procedure: string; quantity: number; amount: number; date: string; kind: string; reward: number };
type Row = { id: string; code: number; name: string; sector: string | null; goal: number; rate: number; sold: number; sold_quantity: number; executed_quantity: number; commission: number; bonus: number; extra_bonus: number; deductions: number; total: number; payable_id: string | null; details: Detail[] };
type Criteria = { company: string; month: string; basis: string };

export default function CommissionsPage() {
  const { clinic, can } = useClinic();
  const [companies, setCompanies] = useState<EntitySearchOption[]>([]);
  const [categories, setCategories] = useState<EntitySearchOption[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [criteria, setCriteria] = useState<Criteria>({ company: "", month: new Date().toISOString().slice(0, 7), basis: "sales" });
  const [applied, setApplied] = useState<Criteria | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [due, setDue] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!clinic.id) return;
    let cancelled = false;
    void Promise.all([
      db.from("companies").select("id,code,name,legal_name,cnpj").eq("clinic_id", clinic.id).eq("active", true).order("name"),
      db.from("financial_categories").select("id,name").eq("clinic_id", clinic.id).eq("type", "expense").order("name"),
    ]).then(([c, cat]) => {
      if (cancelled) return;
      if (c.error || cat.error) { setError("Não foi possível carregar os filtros."); return; }
      setCompanies((c.data || []).map((v: any) => ({ id: v.id, code: String(v.code), label: v.name, legalName: v.legal_name, document: v.cnpj })));
      setCategories((cat.data || []).map((v: any) => ({ id: v.id, label: v.name })));
    });
    return () => { cancelled = true; };
  }, [clinic.id]);

  const consult = async (filter = criteria) => {
    if (!clinic.id || !filter.company || !/^\d{4}-\d{2}$/.test(filter.month)) return toast.error("Selecione a empresa e o mês.");
    setLoading(true); setError(""); setRows([]); setApplied(null);
    try {
      const { data, error: failure } = await db.rpc("preview_commissions", { _clinic: clinic.id, _company: filter.company, _month: `${filter.month}-01`, _basis: filter.basis });
      if (failure) throw failure;
      setRows(data || []); setApplied(filter);
    } catch { setError("Não foi possível consultar as comissões. Tente novamente."); }
    finally { setLoading(false); }
  };

  const pending = rows.filter(r => !r.payable_id && Number(r.total) > 0);
  const pendingTotal = pending.reduce((sum, r) => sum + Number(r.total), 0);
  const changed = !applied || criteria.company !== applied.company || criteria.month !== applied.month || criteria.basis !== applied.basis;
  const generate = async () => {
    if (!clinic.id || !applied || changed || !can("financial", "create") || generating) return;
    setGenerating(true);
    try {
      const { data, error: failure } = await db.rpc("generate_commission_payables", { _clinic: clinic.id, _company: applied.company, _month: `${applied.month}-01`, _basis: applied.basis, _due: due, _category: category });
      if (failure) throw failure;
      toast.success(`${data} conta(s) a pagar gerada(s).`);
      setGenerateOpen(false); setConfirm(false); await consult(applied);
    } catch { toast.error("Não foi possível gerar as contas. Consulte novamente antes de tentar outra vez."); }
    finally { setGenerating(false); }
  };

  const heads = ["Código", "Colaborador / Setor", "Meta mensal", "Vendido", "Qtd. vendida", "Qtd. executada", "Comissão", "Bonificação", "Ajustes", "Total", "Situação", "Detalhes"];
  return <ClinicLayout title="Apuração de Comissões" subtitle="Financeiro">
    <form className="mb-6 space-y-4 border-b border-border pb-6" onSubmit={e => { e.preventDefault(); void consult(); }}>
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2"><EntitySearchInput advanced label="Empresa" value={companyName} options={companies} onQueryChange={name => { setCompanyName(name); setCriteria({ ...criteria, company: "" }); }} onSelect={o => { setCompanyName(o.label); setCriteria({ ...criteria, company: o.id }); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="commission-month">Mês de apuração</Label><Input id="commission-month" type="month" value={criteria.month} onChange={e => setCriteria({ ...criteria, month: e.target.value })} required /></div>
        <div className="space-y-1.5"><Label>Base da comissão de venda</Label><Select value={criteria.basis} onValueChange={basis => setCriteria({ ...criteria, basis })}><SelectTrigger aria-label="Base da comissão de venda"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sales">Vendas do mês</SelectItem><SelectItem value="received">Recebidos do mês</SelectItem></SelectContent></Select></div>
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? "Consultando..." : "Consultar"}</Button></div>
    </form>
    <Tabs defaultValue="calc"><TabsList className="mb-4"><TabsTrigger value="calc">Apuração</TabsTrigger><TabsTrigger value="manual">Lançamentos manuais</TabsTrigger><TabsTrigger value="rules">Regras e percentuais</TabsTrigger></TabsList><TabsContent value="calc">
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">{applied ? `Apuração ${applied.month.split("-").reverse().join("/")}` : "Comissões"}</h2><p className="text-xs text-muted-foreground">{rows.length} colaboradores · Pendente: <strong className="text-foreground">{formatCurrency(pendingTotal)}</strong></p></div>
      {can("financial", "create") && <Button variant="outline" disabled={changed || !pending.length || loading} onClick={() => setGenerateOpen(true)}><FileCheck2 className="mr-2 h-4 w-4" />Gerar contas a pagar</Button>}
    </div>
    <div className="overflow-x-auto border border-border rounded-lg bg-card"><table className="w-full whitespace-nowrap"><thead className="bg-muted"><tr>{heads.map(h => <th key={h} className="text-left text-xs">{h}</th>)}</tr></thead><tbody>
      {rows.map(r => <tr key={r.id} className="border-t border-border hover:bg-muted/30"><td>{r.code}</td><td><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.sector || "Sem setor"}</p></td><td>{r.goal > 0 ? <><p>{formatCurrency(r.goal)}</p><p className="text-xs text-muted-foreground">{(r.sold / r.goal * 100).toFixed(1)}%</p></> : "—"}</td><td>{formatCurrency(r.sold)}</td><td>{r.sold_quantity}</td><td>{r.executed_quantity}</td><td>{formatCurrency(r.commission)}<p className="text-xs text-muted-foreground">{r.rate}%</p></td><td>{formatCurrency(r.bonus)}</td><td>{formatCurrency(Number(r.extra_bonus || 0) - Number(r.deductions || 0))}</td><td className="font-semibold">{formatCurrency(r.total)}</td><td className={r.payable_id ? "text-success" : "text-muted-foreground"}>{r.payable_id ? "Conta gerada" : r.total > 0 ? "Pendente" : "Sem valor"}</td><td><Button variant="ghost" size="icon" aria-label={`Detalhes de ${r.name}`} title="Detalhes" onClick={() => setDetail(r)}><List className="h-4 w-4" /></Button></td></tr>)}
      {!rows.length && <tr><td colSpan={heads.length} className="text-center text-muted-foreground py-12"><Calculator className="mx-auto mb-3 h-6 w-6" />{loading ? "Consultando..." : applied ? "Nenhum colaborador cadastrado" : "Nenhuma apuração consultada"}</td></tr>}
    </tbody></table></div>
    </TabsContent><TabsContent value="manual">{clinic.id && <CommissionAdjustments clinicId={clinic.id} company={criteria.company} month={criteria.month} canEdit={can("financial", "create")} onChanged={() => { if (applied && !changed) void consult(applied); }} />}</TabsContent><TabsContent value="rules">{clinic.id && <CommissionRules clinicId={clinic.id} company={criteria.company} canEdit={can("financial", "create")} />}</TabsContent></Tabs>
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="max-w-4xl max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>{detail?.name} · Lançamentos</DialogTitle></DialogHeader><div className="overflow-auto"><table className="w-full"><thead><tr>{["Data", "Tipo", "Cliente", "Procedimento", "Qtd.", "Valor", "Comissão / Bônus"].map(h => <th key={h} className="text-left text-xs">{h}</th>)}</tr></thead><tbody>{detail?.details.map(d => <tr key={`${d.id}-${d.kind}`} className="border-t border-border"><td>{d.date.split("-").reverse().join("/")}</td><td>{({ sale: "Venda", execution: "Execução", bonus: "Bônus extra", advance: "Adiantamento", discount: "Desconto" } as Record<string,string>)[d.kind] || d.kind}</td><td>{d.patient}</td><td>{d.procedure}</td><td>{d.quantity}</td><td>{formatCurrency(d.amount)}</td><td>{formatCurrency(d.reward)}</td></tr>)}{!detail?.details.length && <tr><td colSpan={7} className="text-center text-muted-foreground">Sem lançamentos no período</td></tr>}</tbody></table></div></DialogContent></Dialog>
    <Dialog open={generateOpen} onOpenChange={open => { if (!generating) setGenerateOpen(open); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Gerar contas a pagar</DialogTitle></DialogHeader><p className="text-sm">{pending.length} colaboradores · {formatCurrency(pendingTotal)}</p><div className="space-y-4"><EntitySearchInput label="Categoria de despesa" value={categoryName} options={categories} onQueryChange={name => { setCategoryName(name); setCategory(""); }} onSelect={o => { setCategory(o.id); setCategoryName(o.label); }} /><div><Label htmlFor="commission-due">Vencimento</Label><Input id="commission-due" type="date" value={due} onChange={e => setDue(e.target.value)} /></div><div className="flex justify-end gap-2"><Button variant="outline" disabled={generating} onClick={() => setGenerateOpen(false)}>Cancelar</Button><Button disabled={!category || !due || generating} onClick={() => setConfirm(true)}>Gerar</Button></div></div></DialogContent></Dialog>
    <ConfirmDialog open={confirm} onOpenChange={open => { if (!generating) setConfirm(open); }} title="Confirmar geração" description={`Gerar contas a pagar para ${pending.length} colaboradores? Total consultado: ${formatCurrency(pendingTotal)}. Os valores serão recalculados na confirmação; contas já geradas não serão duplicadas.`} onConfirm={generate} />
  </ClinicLayout>;
}