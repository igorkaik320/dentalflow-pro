import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AuditLog = Database["public"]["Tables"]["activity_logs"]["Row"];
const areas: Record<string, string> = { patients: "Clientes", procedures: "Procedimentos", suppliers: "Credores", financial_categories: "Categorias", receivables: "Contas a Receber", payables: "Contas a Pagar", payable_installments: "Parcelas", cash_sessions: "Controle de Caixa", patrimony: "Patrimônio", patrimony_items: "Patrimônio", clinics: "Clínica", clinic_members: "Usuários", clinic_member_permissions: "Permissões", clinic_working_hours: "Horários", professionals: "Profissionais", clinical_records: "Prontuários", appointments: "Agenda (histórico)" };
const actions: Record<string, string> = { INSERT: "Cadastro", UPDATE: "Alteração", DELETE: "Exclusão" };
const tones: Record<string, string> = { INSERT: "bg-success/10 text-success", UPDATE: "bg-primary/10 text-primary", DELETE: "bg-destructive/10 text-destructive" };
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });
const pageSize = 30;

function detailsOf(log: AuditLog) {
  const value = log.details;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export default function AuditPage() {
  const { clinic, memberRole } = useClinic();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [area, setArea] = useState("all");
  const [actor, setActor] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const allowed = memberRole === "admin";
  const profiles = useQuery({
    queryKey: ["audit-profiles", clinic.id], enabled: allowed && Boolean(clinic.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email");
      if (error) throw error;
      return data || [];
    },
  });
  const logs = useQuery({
    queryKey: ["audit-logs", clinic.id, action, area, actor, start, end, search, page], enabled: allowed && Boolean(clinic.id),
    queryFn: async () => {
      if (!clinic.id) return { rows: [], count: 0 };
      let query = supabase.from("activity_logs").select("*", { count: "exact" }).eq("clinic_id", clinic.id);
      if (action !== "all") query = query.eq("action", action);
      if (area !== "all") query = query.eq("table_name", area);
      if (actor !== "all") query = actor === "system" ? query.is("user_id", null) : query.eq("user_id", actor);
      if (start) query = query.gte("created_at", `${start}T00:00:00-03:00`);
      if (end) query = query.lte("created_at", `${end}T23:59:59.999-03:00`);
      const term = search.trim().replace(/[%_]/g, "");
      if (term) query = query.ilike("details::text", `%${term}%`);
      const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
  });
  const actorName = (id: string | null) => {
    if (!id) return "Sistema / importação";
    const profile = profiles.data?.find(p => p.user_id === id);
    return profile?.full_name || profile?.email || `Usuário ${id.slice(0, 8)}`;
  };
  const recordName = (log: AuditLog) => {
    const details = detailsOf(log);
    const row = details.current || details.previous;
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return String(row.name || row.description || row.patient_name || row.supplier || log.record_id || "—");
    }
    return log.record_id || "—";
  };
  const filter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(0); };
  const count = logs.data?.count || 0;
  const selectedDetails = selected ? detailsOf(selected) : {};

  return <ClinicLayout title="Auditoria" subtitle="Histórico de atividades · horário de Brasília">
    {!allowed ? <p className="py-12 text-center text-muted-foreground">Acesso exclusivo para administradores.</p> : <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Registros de atividades</h2><p className="text-sm text-muted-foreground">{count.toLocaleString("pt-BR")} eventos encontrados</p></div></div>
        <Button variant="outline" size="icon" title="Atualizar registros" aria-label="Atualizar registros" disabled={logs.isFetching} onClick={() => { void logs.refetch(); void profiles.refetch(); }}><RefreshCw className={`h-4 w-4 ${logs.isFetching ? "motion-safe:animate-spin" : ""}`} /></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="sm:col-span-2"><Label htmlFor="audit-search">Pesquisar registro</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="audit-search" className="pl-9" value={search} onChange={e => filter(setSearch)(e.target.value)} placeholder="Nome, descrição ou identificação" /></div></div>
        <div><Label>Ação</Label><Select value={action} onValueChange={filter(setAction)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as ações</SelectItem>{Object.entries(actions).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Área</Label><Select value={area} onValueChange={filter(setArea)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as áreas</SelectItem>{Object.entries(areas).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="audit-start">Data inicial</Label><Input id="audit-start" type="date" value={start} onChange={e => filter(setStart)(e.target.value)} /></div>
        <div><Label htmlFor="audit-end">Data final</Label><Input id="audit-end" type="date" value={end} min={start} onChange={e => filter(setEnd)(e.target.value)} /></div>
        <div className="sm:col-span-2"><Label>Usuário responsável</Label><Select value={actor} onValueChange={filter(setActor)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os usuários</SelectItem><SelectItem value="system">Sistema / importação</SelectItem>{profiles.data?.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || p.user_id}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {logs.isError || profiles.isError ? <div role="alert" className="border border-destructive/30 rounded-md p-5 text-destructive">Não foi possível carregar a auditoria. <Button variant="outline" onClick={() => { void logs.refetch(); void profiles.refetch(); }}>Tentar novamente</Button></div> : <div className="overflow-x-auto rounded-md border border-border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr>{["Data e hora", "Ação", "Área", "Usuário", "Registro", "Detalhes"].map(label => <th key={label} className="px-4 py-3 text-left font-medium whitespace-nowrap">{label}</th>)}</tr></thead><tbody>
        {logs.data?.rows.map(log => <tr key={log.id} className="border-t border-border hover:bg-muted/30"><td className="px-4 py-3 whitespace-nowrap">{dateFormat.format(new Date(log.created_at))}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${tones[log.action] || "bg-muted text-muted-foreground"}`}>{actions[log.action] || log.action}</span></td><td className="px-4 py-3 whitespace-nowrap">{areas[log.table_name] || log.table_name}</td><td className="px-4 py-3 max-w-56 break-words">{actorName(log.user_id)}</td><td className="px-4 py-3 max-w-64 break-words">{recordName(log)}</td><td className="px-4 py-3"><Button variant="ghost" size="icon" aria-label="Ver detalhes" title="Ver detalhes" onClick={() => setSelected(log)}><Eye className="h-4 w-4" /></Button></td></tr>)}
        {(logs.isLoading || !logs.data?.rows.length) && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">{logs.isLoading ? "Carregando registros..." : "Nenhum evento encontrado."}</td></tr>}
      </tbody></table></div>}
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Página {page + 1} de {Math.max(1, Math.ceil(count / pageSize))}</span><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={page === 0 || logs.isFetching} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Próxima página" disabled={(page + 1) * pageSize >= count || logs.isFetching} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </div>}
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Detalhes da atividade</DialogTitle></DialogHeader>{selected && <div className="space-y-4 text-sm"><dl className="grid gap-3 sm:grid-cols-2">{[["Ação", actions[selected.action] || selected.action], ["Área", areas[selected.table_name] || selected.table_name], ["Responsável", actorName(selected.user_id)], ["Data e hora", dateFormat.format(new Date(selected.created_at))], ["Identificação", selected.record_id || "—"]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all font-medium">{value}</dd></div>)}</dl><div><p className="text-muted-foreground">Campos alterados</p><p className="break-words">{Array.isArray(selectedDetails.changed_columns) && selectedDetails.changed_columns.length ? selectedDetails.changed_columns.join(", ") : "—"}</p></div><div className="grid gap-4 md:grid-cols-2">{[["Antes", selectedDetails.previous], ["Depois", selectedDetails.current]].map(([label, value]) => <section key={String(label)} className="min-w-0"><h3 className="mb-2 font-semibold">{String(label)}</h3><pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-all">{value ? JSON.stringify(value, null, 2) : "Sem dados"}</pre></section>)}</div></div>}</DialogContent></Dialog>
  </ClinicLayout>;
}