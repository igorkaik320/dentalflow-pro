import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Bell, CalendarDays, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency } from "@/lib/utils";
import { clinicToday, isNoticeHidden, noticeStorageKey, summarizeDueInstallments, type DueGroup } from "@/lib/payableDueNotice";
import { toast } from "sonner";

export function PayableDueNotice() {
  const { clinic, user, can } = useClinic();
  const navigate = useNavigate();
  const allowed = can("financial", "view");
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeDueInstallments> | null>(null);

  useEffect(() => {
    setOpen(false);
    setSummary(null);
    if (!clinic.id || !user?.id || !allowed) return;
    const key = noticeStorageKey(clinic.id, user.id);
    const day = clinicToday();
    try { if (isNoticeHidden(localStorage.getItem(key), day)) return; } catch { /* Storage may be disabled. */ }
    let active = true;
    void (async () => {
      const rows = [];
      // Page through the result so clinics with more than 1,000 parcels retain correct totals.
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db.from("payable_installments")
          .select("id, amount, due_date, status").eq("clinic_id", clinic.id)
          .in("status", ["open", "overdue"]).lte("due_date", day)
          .order("id").range(offset, offset + 999);
        if (!active) return;
        if (error) { toast.error("Não foi possível consultar o aviso de parcelas."); return; }
        rows.push(...(data || []));
        if ((data || []).length < 1000) break;
      }
      const next = summarizeDueInstallments(rows, day);
      setSummary(next);
      setOpen(next.today.count + next.overdue.count > 0);
    })();
    return () => { active = false; };
  }, [clinic.id, user?.id, allowed]);

  const view = (group: DueGroup) => {
    setOpen(false);
    navigate(`/financeiro/pagar?view=installments&due=${group}&day=${clinicToday()}`);
  };
  const hideToday = () => {
    if (!clinic.id || !user?.id) return;
    try { localStorage.setItem(noticeStorageKey(clinic.id, user.id), clinicToday()); }
    catch { toast.error("Seu navegador não permitiu salvar a preferência para hoje."); }
    setOpen(false);
  };

  return <Dialog open={open && allowed} onOpenChange={setOpen}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 pr-6"><Bell className="h-5 w-5 text-primary" />Contas a pagar</DialogTitle>
        <DialogDescription>Vencimentos em {new Date(`${clinicToday()}T12:00:00`).toLocaleDateString("pt-BR")}</DialogDescription>
      </DialogHeader>
      {summary && <div className="grid gap-3">
        {(["today", "overdue"] as const).map(group => {
          const Icon = group === "today" ? CalendarDays : AlertCircle;
          return <Button key={group} variant="outline" className="h-auto w-full justify-start gap-3 whitespace-normal px-4 py-4 text-left" onClick={() => view(group)}>
            <Icon className={`h-5 w-5 shrink-0 ${group === "today" ? "text-primary" : "text-destructive"}`} />
            <span className="min-w-0 flex-1"><span className="block text-sm">{group === "today" ? "Parcelas que vencem hoje" : "Parcelas vencidas"}</span><span className="mt-1 block text-xl font-semibold">{formatCurrency(summary[group].amount)}</span><span className="block text-xs font-normal text-muted-foreground">{summary[group].count} parcela(s)</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>;
        })}
      </div>}
      <Button variant="ghost" onClick={hideToday}><EyeOff className="mr-2 h-4 w-4" />Não mostrar novamente hoje</Button>
    </DialogContent>
  </Dialog>;
}