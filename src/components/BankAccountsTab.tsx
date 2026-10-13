import { useEffect, useState } from "react";
import { EntitySearchInput } from "@/components/EntitySearchInput";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency, parseCurrencyInput } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Landmark } from "lucide-react";

type Account = { company_id: string | null; id: string; bank_name: string; agency: string; account_number: string; account_type: string; initial_date: string; initial_balance: number; active: boolean; notes: string | null };
type Form = Omit<Account, "id">;
const today = () => new Date().toISOString().split("T")[0];
const empty: Form = { company_id: null, bank_name: "", agency: "", account_number: "", account_type: "corrente", initial_date: today(), initial_balance: 0, active: true, notes: "" };
const typeLabel: Record<string, string> = { corrente: "Corrente", poupanca: "Poupança", caixa: "Caixa", investimento: "Investimento" };

export function BankAccountsTab() {
  const { clinic } = useClinic();
  const [companies, setCompanies] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [rows, setRows] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [balanceText, setBalanceText] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!clinic.id) return;
    const companyRes = await db.from("companies").select("id,name,active").eq("clinic_id", clinic.id).order("name");
    if (companyRes.error) return toast.error("Não foi possível carregar as empresas.");
    setCompanies(companyRes.data || []);
    const { data, error } = await db.from("bank_accounts").select("*").eq("clinic_id", clinic.id).order("bank_name");
    if (error) return toast.error("Não foi possível carregar as contas correntes.");
    setRows((data || []) as Account[]);
  };
  useEffect(() => { void load(); }, [clinic.id]);

  const openForm = (acc?: Account) => {
    setEditing(acc || null);
    const f = acc ? { ...acc, notes: acc.notes || "" } : empty;
    setForm(f);
    setBalanceText(f.initial_balance ? String(f.initial_balance).replace(".", ",") : "");
    setOpen(true);
  };

  const save = async () => {
    if (!form.company_id) return toast.error("Selecione a empresa da conta.");
    if (!form.bank_name.trim() || !form.account_number.trim()) return toast.error("Informe o banco e o número da conta.");
    if (!form.initial_date) return toast.error("Informe a data inicial.");
    const initial = parseCurrencyInput(balanceText);
    const payload = { company_id: form.company_id, bank_name: form.bank_name.trim(), agency: form.agency, account_number: form.account_number.trim(), account_type: form.account_type, initial_date: form.initial_date, initial_balance: initial, active: form.active, notes: form.notes || null, ...(!editing ? { current_balance: initial } : {}) };
    const { error } = editing
      ? await db.from("bank_accounts").update(payload).eq("id", editing.id).eq("clinic_id", clinic.id)
      : await db.from("bank_accounts").insert({ ...payload, clinic_id: clinic.id });
    if (error) return toast.error("Não foi possível salvar a conta corrente.");
    toast.success(editing ? "Conta atualizada com sucesso" : "Conta cadastrada com sucesso");
    setOpen(false);
    void load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await db.from("bank_accounts").delete().eq("id", deleteId).eq("clinic_id", clinic.id);
    setDeleteId(null);
    if (error) return toast.error("Não foi possível excluir. A conta pode ter lançamentos vinculados — desative-a.");
    toast.success("Conta excluída com sucesso");
    void load();
  };

  return <Card className="overflow-hidden">
    <div className="flex items-center justify-between p-4 border-b border-border">
      <p className="text-sm text-muted-foreground">{rows.length} contas cadastradas</p>
      <Button size="sm" onClick={() => openForm()}><Plus className="h-4 w-4 mr-1" />Nova Conta</Button>
    </div>
    <div className="overflow-x-auto"><table className="w-full">
      <thead><tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><th className="text-left p-3 font-medium">Empresa</th><th className="text-left p-3 font-medium">Banco</th><th className="text-left p-3 font-medium">Agência / Conta</th><th className="text-left p-3 font-medium">Tipo</th><th className="text-left p-3 font-medium">Data inicial</th><th className="text-right p-3 font-medium">Saldo inicial</th><th className="text-right p-3 font-medium">Ações</th></tr></thead>
      <tbody>
        {rows.map(a => <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
          <td className="p-3 text-sm">{companies.find(c => c.id === a.company_id)?.name || "Empresa não definida"}</td><td className="p-3"><div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Landmark className="h-3.5 w-3.5 text-primary" /></div><span className="text-sm font-medium">{a.bank_name}</span>{!a.active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}</div></td>
          <td className="p-3 text-sm text-muted-foreground">{a.agency} / {a.account_number}</td>
          <td className="p-3"><Badge variant="secondary" className="text-xs font-normal">{typeLabel[a.account_type] || a.account_type}</Badge></td>
          <td className="p-3 text-sm text-muted-foreground">{new Date(a.initial_date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
          <td className="p-3 text-sm font-semibold text-right">{formatCurrency(Number(a.initial_balance))}</td>
          <td className="p-3 text-right"><Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Editar conta" onClick={() => openForm(a)}><Edit2 className="h-3 w-3" /></Button><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" aria-label="Excluir conta" onClick={() => setDeleteId(a.id)}><Trash2 className="h-3 w-3" /></Button></td>
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta corrente cadastrada.</td></tr>}
      </tbody>
    </table></div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Editar Conta Corrente" : "Nova Conta Corrente"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5"><EntitySearchInput advanced label="Empresa *" value={companies.find(c => c.id === form.company_id)?.name || ""} options={companies.filter(c => c.active || c.id === form.company_id).map(c => ({ id: c.id, code: c.id.slice(0, 8).toUpperCase(), label: c.name }))} placeholder="Selecione a empresa" onQueryChange={() => setForm({ ...form, company_id: null })} onSelect={o => setForm({ ...form, company_id: o.id })} /></div>
        <div className="col-span-2 space-y-1.5"><Label htmlFor="account-bank">Banco *</Label><Input id="account-bank" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="Ex: Itaú" /></div>
        <div className="space-y-1.5"><Label>Agência</Label><Input value={form.agency} onChange={e => setForm({ ...form, agency: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="account-number">Conta *</Label><Input id="account-number" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Tipo</Label><Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v })}><SelectTrigger aria-label="Tipo da conta"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Data inicial *</Label><Input type="date" value={form.initial_date} onChange={e => setForm({ ...form, initial_date: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="account-balance">Saldo inicial (R$)</Label><Input id="account-balance" inputMode="decimal" value={balanceText} onChange={e => setBalanceText(e.target.value)} placeholder="0,00" /></div>
        <div className="flex items-end gap-2 pb-2"><Checkbox id="acc-active" checked={form.active} onCheckedChange={v => setForm({ ...form, active: Boolean(v) })} /><Label htmlFor="acc-active">Conta ativa</Label></div>
        <div className="col-span-2 space-y-1.5"><Label>Observações</Label><Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></div>
    </DialogContent></Dialog>
    <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Excluir conta corrente" description="Tem certeza que deseja excluir esta conta?" onConfirm={remove} />
  </Card>;
}
