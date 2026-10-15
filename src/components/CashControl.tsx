import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntitySearchInput } from "@/components/EntitySearchInput";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency, parseCurrencyInput } from "@/lib/utils";
import { ArrowDownCircle, ArrowUpCircle, Edit2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Account = { id: string; company_id: string | null; bank_name: string; account_number: string; initial_date: string; initial_balance: number; active: boolean };
type Movement = { supplier_id: string | null; supplier_name: string | null; category_id: string | null; id: string; type: "income" | "expense"; description: string; amount: number; movement_date: string; category: string | null; notes: string | null };
type Entry = { id: string; type: "income" | "expense"; description: string; amount: number; date: string; source: string; manual?: Movement };
const today = () => new Date().toISOString().slice(0, 10);
const empty = () => ({ type: "income" as "income" | "expense", description: "", amount: "", date: today(), supplierId: "", supplierName: "", categoryId: "", category: "", notes: "" });

export function CashControl() {
  const { clinic, user } = useClinic();
  const [companies, setCompanies] = useState<{ id: string; code: number; name: string }[]>([]);
  const [creditors, setCreditors] = useState<{ id: string; code: number; name: string; legal_name: string | null; document: string | null; cnpj: string | null }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [session, setSession] = useState<{ id: string; opened_at: string; opening_balance: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const account = accounts.find(a => a.id === accountId && a.company_id === companyId);
  const available = accounts.filter(a => a.company_id === companyId && a.active);

  useEffect(() => {
    if (!clinic.id) return;
    void Promise.all([
      db.from("companies").select("id,code,name").eq("clinic_id", clinic.id).eq("active", true).order("name"),
      db.from("bank_accounts").select("*").eq("clinic_id", clinic.id).eq("account_type", "caixa").order("bank_name"),
      db.from("suppliers").select("id,code,name,legal_name,document,cnpj").eq("clinic_id", clinic.id).order("name"),
      db.from("financial_categories").select("id,name,type").eq("clinic_id", clinic.id).order("name"),
    ]).then(([c, a, creditorsRes, categoriesRes]) => {
      if (c.error || a.error || creditorsRes.error || categoriesRes.error) { setError(true); toast.error("Não foi possível carregar os caixas."); return; }
      setCompanies(c.data || []); setAccounts(a.data || []); setCreditors(creditorsRes.data || []); setCategories(categoriesRes.data || []);
    });
  }, [clinic.id]);

  const load = async (isCurrent = () => true) => {
    if (!clinic.id || !accountId || !companyId) return;
    setLoading(true); setError(false);
    const [manual, rec, pay, active] = await Promise.all([
      db.from("cash_movements").select("*").eq("clinic_id", clinic.id).eq("bank_account_id", accountId).eq("company_id", companyId),
      db.from("receivables").select("*").eq("clinic_id", clinic.id).eq("bank_account_id", accountId).eq("company_id", companyId).eq("status", "paid"),
      db.from("payable_installments").select("*, payables!inner(description,supplier,company_id)").eq("clinic_id", clinic.id).eq("bank_account_id", accountId).eq("payables.company_id", companyId).eq("status", "paid"),
      db.from("cash_sessions").select("id,opened_at,opening_balance").eq("clinic_id", clinic.id).eq("bank_account_id", accountId).is("closed_at", null).maybeSingle(),
    ]);
    if (!isCurrent()) return;
    setLoading(false);
    if (manual.error || rec.error || pay.error || active.error) { setError(true); toast.error("Não foi possível carregar os movimentos."); return; }
    setSession(active.data || null);
    setEntries([
      ...(manual.data || []).map((m: Movement) => ({ id: m.id, type: m.type, description: [m.supplier_name, m.description].filter(Boolean).join(" · "), amount: Number(m.amount), date: m.movement_date, source: m.category || "Lançamento de caixa", manual: m })),
      ...(rec.data || []).map((r: any) => ({ id: `rec-${r.id}`, type: "income", description: `${r.patient_name} · ${r.procedure_name}`, amount: Number(r.amount), date: r.paid_date, source: "Contas a Receber" })),
      ...(pay.data || []).map((p: any) => ({ id: `pay-${p.id}`, type: "expense", description: `${p.payables.supplier} · ${p.payables.description} · ${p.installment_number}ª parcela`, amount: Number(p.paid_amount ?? p.amount), date: p.paid_date, source: "Contas a Pagar" })),
    ].filter(e => Boolean(e.date)).sort((a, b) => b.date.localeCompare(a.date)));
  };
  useEffect(() => {
    let current = true;
    setEntries([]); setSession(null); setError(false);
    if (accountId && companyId) void load(() => current);
    return () => { current = false; };
  }, [clinic.id, accountId, companyId]);

  const balances = useMemo(() => {
    const valid = entries.filter(e => account && e.date >= account.initial_date);
    const income = valid.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = valid.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, initial: Number(account?.initial_balance || 0), balance: Number(account?.initial_balance || 0) + income - expense };
  }, [entries, account]);
  const filtered = entries.filter(e => (!search || `${e.description} ${e.source}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && (!start || e.date >= start) && (!end || e.date <= end));

  const save = async () => {
    if (!account || !clinic.id) return;
    const amount = parseCurrencyInput(form.amount);
    if (!form.description.trim() || !form.date || !Number.isFinite(amount) || amount <= 0) return toast.error("Informe descrição, data e valor maior que zero.");
    if (form.date < account.initial_date) return toast.error("A data não pode ser anterior à data inicial do caixa.");
    if (form.supplierName && !form.supplierId) return toast.error("Selecione um credor cadastrado.");
    if (form.category && !form.categoryId) return toast.error("Selecione uma categoria cadastrada.");
    setBusy(true);
    const payload = { clinic_id: clinic.id, company_id: companyId, bank_account_id: account.id, supplier_id: form.supplierId || null, supplier_name: form.supplierName || null, category_id: form.categoryId || null, type: form.type, description: form.description.trim(), movement_date: form.date, amount, category: form.category.trim() || null, notes: form.notes.trim() || null };
    const result = editing ? await db.from("cash_movements").update(payload).eq("id", editing.id).eq("clinic_id", clinic.id) : await db.from("cash_movements").insert(payload);
    setBusy(false);
    if (result.error) return toast.error("Não foi possível salvar o movimento.");
    setOpen(false); toast.success(editing ? "Movimento atualizado" : "Movimento cadastrado"); await load();
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    const { error } = await db.from("cash_movements").delete().eq("id", deleting).eq("clinic_id", clinic.id).eq("bank_account_id", accountId);
    setBusy(false); setDeleting(null);
    if (error) return toast.error("Não foi possível excluir o movimento.");
    toast.success("Movimento excluído"); await load();
  };
  const changeSession = async (close: boolean) => {
    if (!account || (close && !session)) return;
    setBusy(true);
    const result = close && session
      ? await db.from("cash_sessions").update({ closed_at: new Date().toISOString(), closed_by: user?.id || null, closing_balance: balances.balance }).eq("id", session.id).eq("clinic_id", clinic.id)
      : await db.from("cash_sessions").insert({ clinic_id: clinic.id, bank_account_id: accountId, opened_by: user?.id || null, opening_balance: balances.balance });
    setBusy(false); setClosing(false);
    if (result.error) return toast.error(close ? "Não foi possível fechar o caixa." : "Não foi possível abrir o caixa.");
    toast.success(close ? "Caixa fechado" : "Caixa aberto"); await load();
  };

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 border-b border-border pb-5">
      <div className="space-y-1.5"><EntitySearchInput advanced label="Empresa" value={companies.find(c => c.id === companyId)?.name || ""} options={companies.map(c => ({ id: c.id, code: String(c.code), label: c.name }))} placeholder="Selecione a empresa" onQueryChange={() => { setCompanyId(""); setAccountId(""); }} onSelect={o => { setCompanyId(o.id); setAccountId(""); }} /></div>
      <div className="space-y-1.5"><Label>Caixa</Label><Select value={accountId} onValueChange={setAccountId} disabled={!companyId}><SelectTrigger aria-label="Selecionar caixa"><SelectValue placeholder="Selecione o caixa" /></SelectTrigger><SelectContent>{available.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} · {a.account_number}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {!account ? <p className="py-8 text-center text-sm text-muted-foreground">{companyId && available.length === 0 ? "Nenhum caixa ativo nesta empresa. Cadastre uma conta com o tipo Caixa em Contas Correntes." : "Selecione a empresa e o caixa."}</p> : <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[["Saldo inicial", balances.initial], ["Entradas", balances.income], ["Saídas", balances.expense], ["Saldo atual", balances.balance]].map(([label, value]) => <div key={String(label)} className="border-b border-border pb-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{loading || error ? "—" : formatCurrency(Number(value))}</p></div>)}</div>
      <div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="font-semibold">{account.bank_name}</h2><p className="text-xs text-muted-foreground">Data inicial: {new Date(account.initial_date + "T12:00:00").toLocaleDateString("pt-BR")} · {session ? `Aberto desde ${new Date(session.opened_at).toLocaleString("pt-BR")}` : "Fechado"}</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy || loading || error} onClick={() => session ? setClosing(true) : void changeSession(false)}>{session ? "Fechar Caixa" : "Abrir Caixa"}</Button><Button disabled={busy || loading || error} onClick={() => { setEditing(null); setForm(empty()); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Novo Lançamento</Button></div></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_170px_170px]"><div><Label htmlFor="cash-search">Pesquisar</Label><Input id="cash-search" value={search} onChange={e => setSearch(e.target.value)} /></div><div><Label htmlFor="cash-start">Data inicial</Label><Input id="cash-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div><div><Label htmlFor="cash-end">Data final</Label><Input id="cash-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div></div>
      <div className="overflow-x-auto border border-border rounded-md"><table className="w-full text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr>{["Data", "Tipo", "Descrição", "Origem / Categoria", "Valor", "Ações"].map(h => <th key={h} className="p-3 text-left font-medium">{h}</th>)}</tr></thead><tbody>{!loading && !error && filtered.map(e => <tr key={e.id} className="border-t border-border/50 hover:bg-muted/30"><td className="p-3 whitespace-nowrap">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</td><td className={`p-3 ${e.type === "income" ? "text-success" : "text-destructive"}`}><span className="flex gap-1 items-center">{e.type === "income" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}{e.type === "income" ? "Entrada" : "Saída"}</span></td><td className="p-3 font-medium">{e.description}</td><td className="p-3 text-muted-foreground">{e.source}</td><td className="p-3 whitespace-nowrap font-semibold">{formatCurrency(e.amount)}</td><td className="p-3 whitespace-nowrap">{e.manual ? <><Button variant="ghost" size="icon" aria-label="Editar movimento" onClick={() => { const m = e.manual; if (!m) return; setEditing(m); setForm({ type: m.type, description: m.description, amount: String(m.amount).replace(".", ","), date: m.movement_date, supplierId: m.supplier_id || "", supplierName: m.supplier_name || "", categoryId: m.category_id || categories.find(c => c.name === m.category && c.type === m.type)?.id || "", category: m.category || "", notes: m.notes || "" }); setOpen(true); }}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" aria-label="Excluir movimento" onClick={() => setDeleting(e.id)}><Trash2 className="h-4 w-4" /></Button></> : "—"}</td></tr>)}{(loading || error || !filtered.length) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{loading ? "Carregando movimentos..." : error ? "Não foi possível carregar. Selecione o caixa novamente." : "Nenhum movimento encontrado."}</td></tr>}</tbody></table></div>
    </>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing ? "Editar Movimento" : "Novo Lançamento de Caixa"}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{companies.find(c => c.id === companyId)?.name} · {account?.bank_name}</p><div className="grid grid-cols-2 gap-3"><div className="col-span-2"><Label>Tipo</Label><Select value={form.type} onValueChange={(type: "income" | "expense") => setForm({ ...form, type, category: "", categoryId: "" })}><SelectTrigger aria-label="Tipo de movimento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Entrada</SelectItem><SelectItem value="expense">Saída</SelectItem></SelectContent></Select></div><div className="col-span-2"><EntitySearchInput advanced label="Credor" value={form.supplierName} options={creditors.map((c) => ({ id: c.id, code: String(c.code), label: c.name, legalName: c.legal_name || "", document: c.document || c.cnpj || "", description: c.legal_name || c.document || c.cnpj || undefined }))} placeholder="Digite para procurar credor" onQueryChange={supplierName => setForm({ ...form, supplierName, supplierId: "" })} onSelect={option => setForm({ ...form, supplierId: option.id, supplierName: option.label })} /></div><div className="col-span-2"><Label htmlFor="movement-description">Descrição *</Label><Input id="movement-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div><div><Label htmlFor="movement-amount">Valor (R$) *</Label><Input id="movement-amount" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div><div><Label htmlFor="movement-date">Data *</Label><Input id="movement-date" type="date" min={account?.initial_date} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div><div className="col-span-2"><EntitySearchInput label="Categoria" value={form.category} options={categories.filter(c => c.type === form.type).map(c => ({ id: c.id, label: c.name, description: form.type === "income" ? "Receita" : "Despesa" }))} placeholder={form.type === "income" ? "Digite para procurar categoria de receita" : "Digite para procurar categoria de despesa"} onQueryChange={category => setForm({ ...form, category, categoryId: "" })} onSelect={option => setForm({ ...form, category: option.label, categoryId: option.id })} /></div><div className="col-span-2"><Label htmlFor="movement-notes">Observações</Label><Input id="movement-notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy} onClick={save}>{busy ? "Salvando..." : "Salvar"}</Button></div></DialogContent></Dialog>
    <ConfirmDialog open={!!deleting} onOpenChange={() => setDeleting(null)} title="Excluir movimento" description="Deseja excluir este movimento? O saldo do caixa será recalculado." onConfirm={remove} />
    <ConfirmDialog open={closing} onOpenChange={setClosing} title="Fechar Caixa" description={`Confirmar fechamento com saldo de ${formatCurrency(balances.balance)}?`} onConfirm={() => changeSession(true)} />
  </div>;
}
