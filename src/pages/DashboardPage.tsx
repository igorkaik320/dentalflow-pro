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
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

type ReceivableRow = {
  id: string;
  amount: number;
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
        amount: installment.status === "paid" ? (installment.paid_amount ?? installment.amount) : installment.amount,
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
    const [receivableRes, payableRes, patientRes, appointmentRes] = await Promise.all([
      db.from("receivables").select("id, amount, status, due_date, paid_date, professional_name").eq("clinic_id", clinic.id),
      db.from("payables").select("id, amount, status, due_date, paid_date, payable_installments(id, amount, paid_amount, status, due_date, paid_date)").eq("clinic_id", clinic.id),
      db.from("patients").select("id, created_at").eq("clinic_id", clinic.id),
      db.from("appointments").select("id, patient_name, professional_name, procedure_name, appointment_date, appointment_time, duration, status").eq("clinic_id", clinic.id).eq("appointment_date", today()).order("appointment_time"),
    ]);
    setLoading(false);

    const error = receivableRes.error || payableRes.error || patientRes.error || appointmentRes.error;
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
    setAppointments(appointmentRes.data || []);
  };

  const metrics = useMemo(() => {
    const periodReceivables = receivables.filter((item) => dateInPeriod(item.paid_date || item.due_date, periodStart, periodEnd));
    const monthlyRevenue = periodReceivables.reduce((sum, item) => sum + item.amount, 0);
    const totalReceived = periodReceivables.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    const totalOpen = periodReceivables.filter((item) => item.status === "open" || item.status === "overdue").reduce((sum, item) => sum + item.amount, 0);
    const newPatients = patients.filter((patient) => dateInPeriod(patient.created_at.slice(0, 10), periodStart, periodEnd)).length;
    return { monthlyRevenue, totalReceived, totalOpen, newPatients };
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
    const balance = metrics.totalReceived - paidExpenses;
    return { paidExpenses, openExpenses, balance };
  }, [payables, metrics.totalReceived, periodStart, periodEnd]);

  const stats = [
    { label: "Faturamento no periodo", value: formatCurrency(metrics.monthlyRevenue), icon: DollarSign, trend: "Atual", up: true },
    { label: "Total Recebido", value: formatCurrency(metrics.totalReceived), icon: TrendingUp, trend: "Pago", up: true },
    { label: "Em Aberto", value: formatCurrency(metrics.totalOpen), icon: Clock, trend: "Pendente", up: false },
    { label: "Clientes Novos", value: metrics.newPatients.toString(), icon: Users, trend: "Mês", up: true },
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{loading ? "..." : stat.value}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-4 w-4 text-primary" />
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
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Receita" />
                <Bar dataKey="expenses" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Resumo Financeiro</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Despesas pagas</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(financialSummary.paidExpenses)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Despesas em aberto</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(financialSummary.openExpenses)}</span>
              </div>
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Saldo recebido</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(financialSummary.balance)}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Agenda de Hoje</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(today() + "T12:00:00").toLocaleDateString("pt-BR")}
            </div>
          </div>
          <div className="space-y-2">
            {!loading && appointments.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum agendamento para hoje.</p>}
            {appointments.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[50px]">
                    <p className="text-sm font-semibold text-foreground">{String(apt.appointment_time).slice(0, 5)}</p>
                    <p className="text-[10px] text-muted-foreground">{apt.duration}min</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{apt.patient_name}</p>
                    <p className="text-xs text-muted-foreground">{apt.procedure_name} • {apt.professional_name}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[apt.status] || statusColors.confirmed}`}>{statusLabels[apt.status] || apt.status}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ClinicLayout>
  );
}

