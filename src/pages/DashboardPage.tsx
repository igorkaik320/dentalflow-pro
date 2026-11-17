import { useEffect, useMemo, useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClinic } from "@/contexts/ClinicContext";
import { usePersistentState } from "@/hooks/usePersistentState";
import { db } from "@/lib/clinicCloud";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Wallet,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { clinicToday } from "@/lib/payableDueNotice";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { receiptAmounts } from "@/lib/receipts";

type ReceivableRow = {
  id: string;
  amount: number;
  interest_amount?: number;
  addition_amount?: number;
  machine_fee?: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  professional_name: string | null;
};

type PayableRow = {
  id: string;
  amount: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  payable_installments?: PayableInstallmentRow[];
};

type PayableInstallmentRow = {
  id: string;
  amount: number;
  paid_amount: number | null;
  status: string;
  due_date: string;
  paid_date: string | null;
};

type PatientRow = {
  id: string;
  created_at: string;
};

type AppointmentRow = {
  id: string;
  patient_name: string;
  professional_name: string;
  procedure_name: string;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  status: string;
};

const statusColors: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  attended: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  missed: "bg-warning/10 text-warning",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  attended: "Compareceu",
  cancelled: "Cancelado",
  missed: "Faltou",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function firstDayOfMonth() {
  return `${today().slice(0, 7)}-01`;
}

function monthKey(date: string | null | undefined) {
  if (!date) return "";
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const date = new Date(`${key}-01T12:00:00`);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function lastSixMonthKeys() {
  const base = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1);
    return date.toISOString().slice(0, 7);
  });
}

function periodMonthKeys(start: string, end: string) {
  if (!start || !end) return lastSixMonthKeys();
  const first = new Date(`${start.slice(0, 7)}-01T12:00:00`);
  const last = new Date(`${end.slice(0, 7)}-01T12:00:00`);
  const keys: string[] = [];
  for (let cursor = first; cursor <= last && keys.length < 12; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    keys.push(cursor.toISOString().slice(0, 7));
  }
  return keys.length ? keys : lastSixMonthKeys();
}

function dateInPeriod(dateText: string | null | undefined, start: string, end: string) {
  if (!dateText) return false;
  if (start && dateText < start) return false;
  if (end && dateText > end) return false;
  return true;
}

function payableExpenseRows(payables: PayableRow[]) {
  return payables.flatMap((payable) => {
    if (payable.payable_installments?.length) {
      return payable.payable_installments.map((installment) => ({
        // Juros/acréscimos já viram lançamentos próprios; não contar duas vezes.
        amount: installment.status === "paid" ? (installment.paid_amount ?? installment.amount) - Number((installment as any).juros_multa || 0) - Number((installment as any).acrescimo || 0) : installment.amount,
        status: installment.status,
        due_date: installment.due_date,
        paid_date: installment.paid_date,
      }));
    }
    return [{
      amount: payable.amount,
      status: payable.status,
      due_date: payable.due_date,
      paid_date: payable.paid_date,
    }];
  });
}

export default function DashboardPage() {
  const { clinic } = useClinic();
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = usePersistentState("dentalflow.dashboard.periodStart", firstDayOfMonth());
  const [periodEnd, setPeriodEnd] = usePersistentState("dentalflow.dashboard.periodEnd", today());

  useEffect(() => {
    if (!clinic.id) {
      setLoading(false);
      return;
    }
    void loadDashboard();
  }, [clinic.id]);

  const loadDashboard = async () => {
    if (!clinic.id) return;
    setLoading(true);
    const [receivableRes, payableRes, patientRes] = await Promise.all([
      db.from("receivables").select("id, amount, interest_amount, addition_amount, machine_fee, status, due_date, paid_date, professional_name").eq("clinic_id", clinic.id),
      db.from("payables").select("id, amount, status, due_date, paid_date, payable_installments(id, amount, paid_amount, juros_multa, acrescimo, status, due_date, paid_date)").eq("clinic_id", clinic.id),
      db.from("patients").select("id, created_at").eq("clinic_id", clinic.id),
    ]);
    setLoading(false);

    const error = receivableRes.error || payableRes.error || patientRes.error;
    if (error) return toast.error("Não foi possível carregar o dashboard.");

    setReceivables((receivableRes.data || []).map((row: any) => ({ ...row, amount: Number(row.amount || 0) })));
    setPayables((payableRes.data || []).map((row: any) => ({
      ...row,
      amount: Number(row.amount || 0),
      payable_installments: (row.payable_installments || []).map((item: any) => ({
        ...item,
        amount: Number(item.amount || 0),
        paid_amount: item.paid_amount == null ? null : Number(item.paid_amount),
      })),
    })));
    setPatients(patientRes.data || []);
  };

  const metrics = useMemo(() => {
    const periodReceivables = receivables.filter((item) => dateInPeriod(item.paid_date || item.due_date, periodStart, periodEnd));
    const monthlyRevenue = periodReceivables.reduce((sum, item) => sum + item.amount, 0);
    const totalReceived = periodReceivables.filter((item) => item.status === "paid").reduce((sum, item) => sum + receiptAmounts(item).net, 0);
    const totalOpen = periodReceivables.filter((item) => item.status === "open" || item.status === "overdue").reduce((sum, item) => sum + item.amount, 0);
    const newPatients = patients.filter((patient) => dateInPeriod(patient.created_at.slice(0, 10), periodStart, periodEnd)).length;
    const machineFees = periodReceivables.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.machine_fee || 0), 0);
    // Atrasados: sempre considera todos os títulos, independente do período filtrado.
    const t = clinicToday();
    const overdueRows = receivables.filter((item) => (item.status === "open" || item.status === "overdue") && item.due_date < t);
    const overdueAmount = overdueRows.reduce((sum, item) => sum + item.amount, 0);
    return { monthlyRevenue, totalReceived, totalOpen, newPatients, machineFees, overdueAmount, overdueCount: overdueRows.length };
  }, [receivables, patients, periodStart, periodEnd]);

  const monthlyData = useMemo(() => {
    const expenseRows = payableExpenseRows(payables);
    return periodMonthKeys(periodStart, periodEnd).map((key) => ({
      month: monthLabel(key),
      revenue: receivables
        .filter((item) => monthKey(item.paid_date || item.due_date) === key)
        .reduce((sum, item) => sum + item.amount, 0),
      expenses: expenseRows
        .filter((item) => monthKey(item.paid_date || item.due_date) === key)
        .reduce((sum, item) => sum + item.amount, 0),
    }));
  }, [receivables, payables, periodStart, periodEnd]);

  const financialSummary = useMemo(() => {
    const expenseRows = payableExpenseRows(payables).filter((item) => dateInPeriod(item.paid_date || item.due_date, periodStart, periodEnd));
    const paidExpenses = expenseRows.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    const openExpenses = expenseRows.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.amount, 0);
    const t = today();
    const overdueExpenses = expenseRows.filter((item) => item.status !== "paid" && item.due_date < t).reduce((sum, item) => sum + item.amount, 0);
    const upcoming = payableExpenseRows(payables)
      .filter((item) => item.status !== "paid" && item.due_date >= t)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);
    return { paidExpenses, openExpenses, overdueExpenses, upcoming };
  }, [payables, metrics.totalReceived, periodStart, periodEnd]);

  const stats = [
    { label: "Faturamento no periodo", value: formatCurrency(metrics.monthlyRevenue), icon: DollarSign, trend: "Atual", up: true },
    { label: "Total Recebido", value: formatCurrency(metrics.totalReceived), icon: TrendingUp, trend: "Pago", up: true },
    { label: "A receber (em aberto)", value: formatCurrency(metrics.totalOpen), icon: Clock, trend: "Pendente", up: false },
    { label: "Atrasados", value: formatCurrency(metrics.overdueAmount), icon: AlertCircle, trend: `${metrics.overdueCount} titulo(s)`, up: false, danger: metrics.overdueAmount > 0 },
    { label: "Despesas pagas", value: formatCurrency(financialSummary.paidExpenses), icon: Wallet, trend: "Saídas", up: false },
  ];

  return (
    <ClinicLayout title="Dashboard" subtitle="Visão geral da clínica com dados atualizados">
      <div className="space-y-6 animate-fade-in">
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_auto] gap-3 items-end">
            <div>
              <p className="text-sm font-semibold text-foreground">Periodo do dashboard</p>
              <p className="text-xs text-muted-foreground">Filtra indicadores, grafico e resumo financeiro.</p>
            </div>
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={() => { setPeriodStart(firstDayOfMonth()); setPeriodEnd(today()); }}>
              Mes atual
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className={`stat-card ${stat.danger ? "border-destructive/40" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.danger ? "text-destructive" : "text-foreground"}`}>{loading ? "..." : stat.value}</p>
                </div>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${stat.danger ? "bg-destructive/10" : "bg-primary/10"}`}>
                  <stat.icon className={`h-4 w-4 ${stat.danger ? "text-destructive" : "text-primary"}`} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {stat.up ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
                <span className={`text-xs font-medium ${stat.up ? "text-success" : "text-destructive"}`}>{stat.trend}</span>
                <span className="text-xs text-muted-foreground">atualizados</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Evolução Mensal</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${Number(v) / 1000}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Receita" />
                <Bar dataKey="expenses" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Resumo Financeiro</h3>
            <div className="space-y-3">
              {[
                ["Recebido líquido", metrics.totalReceived, "text-success"],
                ["Taxas de maquininha", metrics.machineFees, "text-muted-foreground"],
                ["A receber em aberto", metrics.totalOpen, "text-foreground"],
                ["Despesas em aberto", financialSummary.openExpenses, "text-foreground"],
                ["Despesas vencidas", financialSummary.overdueExpenses, "text-destructive"],
              ].map(([label, value, color]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className={`text-sm font-semibold ${color}`}>{loading ? "..." : formatCurrency(value as number)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Próximos vencimentos</p>
              {financialSummary.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta a vencer.</p>
              ) : financialSummary.upcoming.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-muted-foreground">{new Date(`${item.due_date}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                  <span className="font-medium text-foreground">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>


      </div>
    </ClinicLayout>
  );
}

