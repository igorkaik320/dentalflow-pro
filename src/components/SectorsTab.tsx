import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Users, Search } from "lucide-react";

export const goalPeriods: Record<string, string> = { monthly: "Mensal", biweekly: "Quinzenal", weekly: "Semanal", quarterly: "Trimestral", yearly: "Anual" };

type Sector = { id: string; name: string; responsible_id: string | null; goal_amount: number; goal_period: string; active: boolean; notes: string | null };
type Form = Omit<Sector, "id">;
const empty: Form = { name: "", responsible_id: null, goal_amount: 0, goal_period: "monthly", active: true, notes: "" };
const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SectorsTab() {
  const { clinic } = useClinic();
  const [rows, setRows] = useState<Sector[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string; sector_id: string | null }[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!clinic.id) return;
    const [s, p] = await Promise.all([
      db.from("sectors").select("*").eq("clinic_id", clinic.id).order("name"),
      db.from("suppliers").select("id,name,sector_id").eq("clinic_id", clinic.id).eq("is_collaborator", true).order("name"),
    ]);
    if (s.error) return toast.error("Não foi possível carregar os setores.");
    setRows((s.data || []) as Sector[]);
    setPeople(p.data || []);
  };
  useEffect(() => { void load(); }, [clinic.id]);

  const openForm = (s?: Sector) => { setEditing(s || null); setForm(s ? { ...s } : empty); setOpen(true); };
  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome do setor.");
    const payload = { clinic_id: clinic.id, name: form.name.trim(), responsible_id: form.responsible_id || null, goal_amount: Number(form.goal_amount) || 0, goal_period: form.goal_period, active: form.active, notes: form.notes || null };
    const { error } = editing ? await db.from("sectors").update(payload).eq("id", editing.id).eq("clinic_id", clinic.id) : await db.from("sectors").insert(payload);
    if (error) return toast.error(error.code === "23505" ? "Já existe um setor com esse nome." : "Não foi possível salvar o setor.");
    toast.success(editing ? "Setor atualizado" : "Setor cadastrado");
    setOpen(false); void load();
  };
  const remove = async () => {
    if (!deleteId) return;
    const { error } = await db.from("sectors").delete().eq("id", deleteId).eq("clinic_id", clinic.id);
    setDeleteId(null);
    if (error) return toast.error("Não foi possível excluir o setor.");
    toast.success("Setor excluído"); void load();
  };

  const filtered = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const nameOf = (id: string | null) => people.find(p => p.id === id)?.name || "-";

  return <>
    <div className="mb-4 max-w-xl relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar setor" value={search} onChange={e => setSearch(e.target.value)} /></div>
    <Card>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <span className="text-sm text-muted-foreground">{filtered.length} setores cadastrados</span>
        <Button size="sm" onClick={() => openForm()}><Plus className="h-4 w-4 mr-1" />Novo Setor</Button>
      </div>
      <div className="overflow-x-auto"><table className="w-full">
        <thead><tr className="border-b border-border bg-muted/50">
          {["Setor", "Responsável", "Meta", "Período", "Colaboradores", "Situação"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground p-3">{h}</th>)}
          <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
        </tr></thead>
        <tbody>
          {filtered.map(s => <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
            <td className="p-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><span className="text-sm font-medium text-foreground">{s.name}</span></div></td>
            <td className="p-3 text-sm text-muted-foreground">{nameOf(s.responsible_id)}</td>
            <td className="p-3 text-sm text-foreground">{s.goal_amount ? money(s.goal_amount) : "-"}</td>
            <td className="p-3 text-sm text-muted-foreground">{goalPeriods[s.goal_period]}</td>
            <td className="p-3 text-sm text-muted-foreground">{people.filter(p => p.sector_id === s.id).length}</td>
            <td className="p-3"><Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Ativo" : "Inativo"}</Badge></td>
            <td className="p-3 text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(s)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4" /></Button></td>
          </tr>)}
          {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Nenhum setor encontrado.</td></tr>}
        </tbody>
      </table></div>
    </Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing ? "Editar Setor" : "Novo Setor"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="col-span-2 space-y-1.5"><Label>Nome do setor *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Responsável (opcional)</Label>
          <Select value={form.responsible_id || "none"} onValueChange={v => setForm({ ...form, responsible_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">Sem responsável</SelectItem>{people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {people.length === 0 && <p className="text-[11px] text-muted-foreground">Marque credores como Colaborador para escolhê-los aqui.</p>}
        </div>
        <div className="space-y-1.5"><Label>Meta (R$)</Label><Input type="number" min={0} step="0.01" value={form.goal_amount} onChange={e => setForm({ ...form, goal_amount: Number(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label>Período da meta</Label>
          <Select value={form.goal_period} onValueChange={v => setForm({ ...form, goal_period: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(goalPeriods).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="col-span-2 space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <label className="col-span-2 flex items-center gap-2 text-sm"><Checkbox checked={form.active} onCheckedChange={v => setForm({ ...form, active: Boolean(v) })} />Setor ativo</label>
      </div>
      <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></div>
    </DialogContent></Dialog>

    <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Excluir setor" description="Os colaboradores ligados ficarão sem setor. Deseja excluir?" onConfirm={remove} />
  </>;
}
