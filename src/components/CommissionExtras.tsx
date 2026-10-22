import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { db } from "@/lib/clinicCloud";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const kinds: Record<string, string> = { bonus: "Bônus/premiação extra", advance: "Adiantamento", discount: "Desconto" };
type Adj = { id: string; supplier_id: string; kind: string; amount: number; description: string | null };
type Form = { id?: string; supplier_id: string; kind: string; amount: string; description: string };
const empty: Form = { supplier_id: "", kind: "bonus", amount: "", description: "" };

export function CommissionAdjustments({ clinicId, company, month, canEdit, onChanged }: { clinicId: string; company: string; month: string; canEdit: boolean; onChanged: () => void }) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<Adj[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [remove, setRemove] = useState<Adj | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!company || !month) { setItems([]); return; }
    const { data, error } = await db.from("commission_adjustments").select("id,supplier_id,kind,amount,description").eq("clinic_id", clinicId).eq("company_id", company).eq("period", month).order("created_at");
    if (error) toast.error("Não foi possível carregar os lançamentos manuais."); else setItems((data || []) as Adj[]);
  };
  useEffect(() => {
    void db.from("suppliers").select("id,name").eq("clinic_id", clinicId).eq("is_collaborator", true).order("name").then(({ data }) => setPeople(data || []));
  }, [clinicId]);
  useEffect(() => { void load(); }, [clinicId, company, month]);

  const save = async () => {
    if (!form) return;
    const amount = Number(form.amount.replace(",", "."));
    if (!form.supplier_id || !(amount > 0)) return toast.error("Selecione o colaborador e informe um valor maior que zero.");
    setSaving(true);
    const payload = { clinic_id: clinicId, company_id: company, period: month, supplier_id: form.supplier_id, kind: form.kind, amount, description: form.description.trim() || null };
    const { error } = form.id ? await db.from("commission_adjustments").update(payload).eq("id", form.id) : await db.from("commission_adjustments").insert(payload);
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar o lançamento.");
    toast.success(form.id ? "Lançamento alterado." : "Lançamento cadastrado.");
    setForm(null); await load(); onChanged();
  };
  const del = async () => {
    if (!remove) return;
    const { error } = await db.from("commission_adjustments").delete().eq("id", remove.id);
    if (error) toast.error("Não foi possível excluir."); else { toast.success("Lançamento excluído."); await load(); onChanged(); }
    setRemove(null);
  };
  const name = (id: string) => people.find(p => p.id === id)?.name || "—";

  if (!company) return <p className="py-10 text-center text-sm text-muted-foreground">Selecione a empresa e o mês no filtro acima para ver os lançamentos manuais.</p>;
  return <div>
    <div className="mb-3 flex items-center justify-between"><p className="text-sm text-muted-foreground">Lançamentos manuais de {month.split("-").reverse().join("/")} — entram no total da apuração.</p>
      {canEdit && <Button onClick={() => setForm({ ...empty })}><Plus className="mr-2 h-4 w-4" />Novo lançamento</Button>}</div>
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full"><thead className="bg-muted"><tr>{["Colaborador", "Tipo", "Descrição", "Valor", ""].map(h => <th key={h} className="text-left text-xs">{h}</th>)}</tr></thead><tbody>
      {items.map(i => <tr key={i.id} className="border-t border-border"><td>{name(i.supplier_id)}</td><td>{kinds[i.kind]}</td><td>{i.description || "—"}</td><td className={i.kind === "bonus" ? "text-success" : "text-destructive"}>{i.kind === "bonus" ? "+" : "-"}{formatCurrency(Number(i.amount))}</td>
        <td className="text-right">{canEdit && <><Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setForm({ id: i.id, supplier_id: i.supplier_id, kind: i.kind, amount: String(i.amount), description: i.description || "" })}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setRemove(i)}><Trash2 className="h-4 w-4" /></Button></>}</td></tr>)}
      {!items.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nenhum lançamento manual neste mês</td></tr>}
    </tbody></table></div>
    <Dialog open={!!form} onOpenChange={o => { if (!o && !saving) setForm(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{form?.id ? "Editar lançamento" : "Novo lançamento manual"}</DialogTitle></DialogHeader>
      {form && <div className="space-y-4">
        <div className="space-y-1.5"><Label>Colaborador</Label><Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}><SelectTrigger><SelectValue placeholder={people.length ? "Selecione" : "Nenhum credor marcado como colaborador"} /></SelectTrigger><SelectContent>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Tipo</Label><Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(kinds).map(([k, l]) => <SelectItem key={k} value={k}>{l}{k === "bonus" ? " (soma)" : " (desconta)"}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="adj-amount">Valor (R$)</Label><Input id="adj-amount" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="adj-desc">Descrição</Label><Input id="adj-desc" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex.: meta da equipe batida" /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div>
      </div>}
    </DialogContent></Dialog>
    <ConfirmDialog open={!!remove} onOpenChange={o => { if (!o) setRemove(null); }} title="Excluir lançamento" description="Deseja excluir este lançamento manual?" onConfirm={del} />
  </div>;
}

type Person = { id: string; code: number; name: string; commission_rate: number | null; individual_goal: number | null };
type Proc = { id: string; name: string; default_price: number; bonus_type: string; bonus_value: number };

export function CommissionRules({ clinicId, company, canEdit }: { clinicId: string; company: string; canEdit: boolean }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [procs, setProcs] = useState<Proc[]>([]);
  useEffect(() => {
    void db.from("suppliers").select("id,code,name,commission_rate,individual_goal").eq("clinic_id", clinicId).eq("is_collaborator", true).order("name").then(({ data }) => setPeople((data || []) as Person[]));
  }, [clinicId]);
  useEffect(() => {
    if (!company) { setProcs([]); return; }
    void db.from("procedures").select("id,name,default_price,bonus_type,bonus_value").eq("clinic_id", clinicId).eq("company_id", company).eq("active", true).order("name").then(({ data }) => setProcs((data || []) as Proc[]));
  }, [clinicId, company]);

  const savePerson = async (p: Person) => {
    const { error } = await db.from("suppliers").update({ commission_rate: Number(p.commission_rate || 0), individual_goal: Number(p.individual_goal || 0) }).eq("id", p.id);
    error ? toast.error("Não foi possível salvar.") : toast.success(`Regras de ${p.name} salvas.`);
  };
  const saveProc = async (p: Proc) => {
    const { error } = await db.from("procedures").update({ bonus_type: p.bonus_type, bonus_value: p.bonus_type === "none" ? 0 : Number(p.bonus_value || 0) }).eq("id", p.id);
    error ? toast.error("Não foi possível salvar.") : toast.success(`Bonificação de ${p.name} salva.`);
  };
  const setP = (id: string, c: Partial<Person>) => setPeople(ps => ps.map(p => p.id === id ? { ...p, ...c } : p));
  const setQ = (id: string, c: Partial<Proc>) => setProcs(ps => ps.map(p => p.id === id ? { ...p, ...c } : p));

  return <div className="space-y-8">
    <section><h3 className="mb-1 text-sm font-semibold">Comissão de venda por colaborador</h3><p className="mb-3 text-xs text-muted-foreground">Percentual aplicado sobre o valor vendido e meta individual mensal.</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full"><thead className="bg-muted"><tr>{["Código", "Colaborador", "Comissão (%)", "Meta mensal (R$)", ""].map(h => <th key={h} className="text-left text-xs">{h}</th>)}</tr></thead><tbody>
        {people.map(p => <tr key={p.id} className="border-t border-border"><td>{p.code}</td><td>{p.name}</td>
          <td><Input className="h-8 w-28" type="number" step="0.01" min="0" disabled={!canEdit} value={p.commission_rate ?? ""} onChange={e => setP(p.id, { commission_rate: e.target.value as any })} /></td>
          <td><Input className="h-8 w-36" type="number" step="0.01" min="0" disabled={!canEdit} value={p.individual_goal ?? ""} onChange={e => setP(p.id, { individual_goal: e.target.value as any })} /></td>
          <td>{canEdit && <Button size="sm" variant="outline" onClick={() => savePerson(p)}><Save className="mr-1 h-4 w-4" />Salvar</Button>}</td></tr>)}
        {!people.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Marque credores como colaborador em Cadastros → Credores</td></tr>}
      </tbody></table></div></section>
    <section><h3 className="mb-1 text-sm font-semibold">Bonificação de execução por procedimento</h3><p className="mb-3 text-xs text-muted-foreground">Valor fixo (multiplicado pela quantidade) ou percentual sobre o valor do lançamento, pago a quem executou.</p>
      {!company ? <p className="py-6 text-center text-sm text-muted-foreground">Selecione a empresa no filtro acima para ver os procedimentos.</p> :
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full"><thead className="bg-muted"><tr>{["Procedimento", "Preço", "Tipo", "Valor", ""].map(h => <th key={h} className="text-left text-xs">{h}</th>)}</tr></thead><tbody>
        {procs.map(p => <tr key={p.id} className="border-t border-border"><td>{p.name}</td><td>{formatCurrency(Number(p.default_price))}</td>
          <td><Select value={p.bonus_type} disabled={!canEdit} onValueChange={v => setQ(p.id, { bonus_type: v })}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem bônus</SelectItem><SelectItem value="fixed">Valor fixo</SelectItem><SelectItem value="percent">Percentual</SelectItem></SelectContent></Select></td>
          <td><Input className="h-8 w-28" type="number" step="0.01" min="0" disabled={!canEdit || p.bonus_type === "none"} value={p.bonus_value ?? ""} onChange={e => setQ(p.id, { bonus_value: e.target.value as any })} /></td>
          <td>{canEdit && <Button size="sm" variant="outline" onClick={() => saveProc(p)}><Save className="mr-1 h-4 w-4" />Salvar</Button>}</td></tr>)}
        {!procs.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum procedimento ativo nesta empresa</td></tr>}
      </tbody></table></div>}</section>
  </div>;
}
