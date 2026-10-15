import { useEffect, useState } from "react";
import { EntitySearchInput } from "@/components/EntitySearchInput";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCNPJ } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Building2 } from "lucide-react";

type Company = { code: number; id: string; name: string; legal_name: string | null; cnpj: string | null; phone: string | null; email: string | null; address: string | null; active: boolean };
type Form = Omit<Company, "id" | "code">;
const empty: Form = { name: "", legal_name: "", cnpj: "", phone: "", email: "", address: "", active: true };

export function CompaniesTab() {
  const { clinic } = useClinic();
  const [rows, setRows] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filteredRows = rows.filter(c => normalize(`${c.code} ${c.name} ${c.legal_name || ""} ${c.cnpj || ""}`).includes(normalize(search)) || (search.replace(/\D/g, "").length >= 3 && (c.cnpj || "").replace(/\D/g, "").includes(search.replace(/\D/g, ""))));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!clinic.id) return;
    const { data, error } = await db.from("companies").select("*").eq("clinic_id", clinic.id).order("name");
    if (error) return toast.error("Não foi possível carregar as empresas.");
    setRows((data || []) as Company[]);
  };
  useEffect(() => { void load(); }, [clinic.id]);

  const openForm = (c?: Company) => {
    setEditing(c || null);
    setForm(c ? { name: c.name, legal_name: c.legal_name, cnpj: c.cnpj, phone: c.phone, email: c.email, address: c.address, active: c.active } : empty);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome da empresa.");
    const payload = { ...form, clinic_id: clinic.id, legal_name: form.legal_name || null, cnpj: form.cnpj || null, phone: form.phone || null, email: form.email || null, address: form.address || null };
    const { error } = editing
      ? await db.from("companies").update(payload).eq("id", editing.id).eq("clinic_id", clinic.id)
      : await db.from("companies").insert(payload);
    if (error) return toast.error("Não foi possível salvar a empresa.");
    toast.success(editing ? "Empresa atualizada com sucesso" : "Empresa cadastrada com sucesso");
    setOpen(false);
    void load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await db.from("companies").delete().eq("id", deleteId).eq("clinic_id", clinic.id);
    setDeleteId(null);
    if (error) return toast.error("Não foi possível excluir a empresa.");
    toast.success("Empresa excluída");
    void load();
  };

  return <>
    <div className="mb-4 max-w-xl"><EntitySearchInput advanced label="Empresa" value={search} options={rows.map(c => ({ id: c.id, code: String(c.code), label: c.name, legalName: c.legal_name || "", document: c.cnpj || "" }))} placeholder="Nome, razão social ou CNPJ" onQueryChange={setSearch} onSelect={o => setSearch(o.label)} /></div>
    <Card>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <span className="text-sm text-muted-foreground">{filteredRows.length} empresas cadastradas</span>
        <Button size="sm" onClick={() => openForm()}><Plus className="h-4 w-4 mr-1" />Nova Empresa</Button>
      </div>
      <div className="overflow-x-auto"><table className="w-full">
        <thead><tr className="border-b border-border bg-muted/50">
          <th className="text-left text-xs font-medium text-muted-foreground p-3">Código</th><th className="text-left text-xs font-medium text-muted-foreground p-3">Empresa</th>
          <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">CNPJ</th>
          <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Contato</th>
          <th className="text-left text-xs font-medium text-muted-foreground p-3">Situação</th>
          <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
        </tr></thead>
        <tbody>
          {filteredRows.map(c => <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
            <td className="p-3 text-sm text-muted-foreground">{c.code}</td><td className="p-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium text-foreground">{c.name}</p>{c.legal_name && <p className="text-xs text-muted-foreground">{c.legal_name}</p>}</div></div></td>
            <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{c.cnpj || "-"}</td>
            <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{[c.phone, c.email].filter(Boolean).join(" · ") || "-"}</td>
            <td className="p-3"><Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge></td>
            <td className="p-3 text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(c)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button></td>
          </tr>)}
          {filteredRows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada.</td></tr>}
        </tbody>
      </table></div>
    </Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3 mt-2"><div className="col-span-2 space-y-1.5"><Label>Código</Label><Input value={editing?.code ?? "Automático"} readOnly /></div>
        <div className="col-span-2 space-y-1.5"><Label>Nome fantasia *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Razão social</Label><Input value={form.legal_name || ""} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>CNPJ</Label><Input value={form.cnpj || ""} onChange={e => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>E-mail</Label><Input value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div className="col-span-2 space-y-1.5"><Label>Endereço</Label><Input value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
        <label className="col-span-2 flex items-center gap-2 text-sm"><Checkbox checked={form.active} onCheckedChange={v => setForm({ ...form, active: Boolean(v) })} />Empresa ativa</label>
      </div>
      <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></div>
    </DialogContent></Dialog>

    <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Excluir empresa" description="Os lançamentos ligados a ela continuam salvos. Deseja excluir?" onConfirm={remove} />
  </>;
}
