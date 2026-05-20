import { useEffect, useMemo, useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { useClinic } from "@/contexts/ClinicContext";
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

type ProfessionalRow = {
  id: string;
  name: string;
  commission_rate: number;
  active: boolean;
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

export default function DashboardPage() {
  const { clinic } = useClinic();
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [receivableRes, payableRes, patientRes, appointmentRes, professionalRes] = await Promise.all([
      db.from("receivables").select("id, amount, status, due_date, paid_date, professional_name").eq("clinic_id", clinic.id),
      db.from("payables").select("id, amount, status, due_date, paid_date").eq("clinic_id", clinic.id),
      db.from("patients").select("id, created_at").eq("clinic_id", clinic.id),
      db.from("appointments").select("id, patient_name, professional_name, procedure_name, appointment_date, appointment_time, duration, status").eq("clinic_id", clinic.id).eq("appointment_date", today()).order("appointment_time"),
      db.from("professionals").select("id, name, commission_rate, active").eq("clinic_id", clinic.id),
    ]);
    setLoading(false);

    const error = receivableRes.error || payableRes.error || patientRes.error || appointmentRes.error || professionalRes.error;
    if (error) return toast.error("Não foi possível carregar o dashboard.");

    setReceivables((receivableRes.data || []).map((row: any) => ({ ...row, amount: Number(row.amount || 0) })));
    setPayables((payableRes.data || []).map((row: any) => ({ ...row, amount: Number(row.amount || 0) })));
    setPatients(patientRes.data || []);
    setAppointments(appointmentRes.data || []);
    setProfessionals((professionalRes.data || []).map((row: any) => ({ ...row, commission_rate: Number(row.commission_rate || 0) })));
  };

  const currentMonth = today().slice(0, 7);

  const metrics = useMemo(() => {
    const monthReceivables = receivables.filter((item) => monthKey(item.due_date) === currentMonth || monthKey(item.paid_date) === currentMonth);
    const monthlyRevenue = monthReceivables.reduce((sum, item) => sum + item.amount, 0);
    const totalReceived = receivables.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    const totalOpen = receivables.filter((item) => item.status === "open" || item.status === "overdue").reduce((sum, item) => sum + item.amount, 0);
    const newPatients = patients.filter((patient) => monthKey(patient.created_at) === currentMonth).length;
    return { monthlyRevenue, totalReceived, totalOpen, newPatients };
  }, [receivables, patients, currentMonth]);

  const monthlyData = useMemo(() => {
    return lastSixMonthKeys().map((key) => ({
      month: monthLabel(key),
      revenue: receivables
        .filter((item) => monthKey(item.paid_date || item.due_date) === key)
        .reduce((sum, item) => sum + item.amount, 0),
      expenses: payables
        .filter((item) => monthKey(item.paid_date || item.due_date) === key)
        .reduce((sum, item) => sum + item.amount, 0),
    }));
  }, [receivables, payables]);

  const commissions = useMemo(() => {
    return professionals
      .filter((professional) => professional.active)
      .map((professional) => {
        const totalBilled = receivables
          .filter((item) => item.status === "paid" && item.professional_name === professional.name)
          .reduce((sum, item) => sum + item.amount, 0);
        return {
          professional: professional.name,
          rate: professional.commission_rate,
          total: totalBilled * (professional.commission_rate / 100),
        };
      })
      .filter((item) => item.total > 0);
  }, [professionals, receivables]);

  const stats = [
    { label: "Faturamento Mensal", value: formatCurrency(metrics.monthlyRevenue), icon: DollarSign, trend: "Atual", up: true },
    { label: "Total Recebido", value: formatCurrency(metrics.totalReceived), icon: TrendingUp, trend: "Pago", up: true },
    { label: "Em Aberto", value: formatCurrency(metrics.totalOpen), icon: Clock, trend: "Pendente", up: false },
    { label: "Pacientes Novos", value: metrics.newPatients.toString(), icon: Users, trend: "Mês", up: true },
  ];

  return (
    <ClinicLayout title="Dashboard" subtitle="Visão geral da clínica com dados atualizados">
      <div className="space-y-6 animate-fade-in">
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
            <h3 className="text-sm font-semibold text-foreground mb-4">Comissões do Mês</h3>
            <div className="space-y-4">
              {commissions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma comissão paga no período.</p>}
              {commissions.map((c) => (
                <div key={c.professional} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.professional}</p>
                    <p className="text-xs text-muted-foreground">{c.rate}% de comissão</p>
                  </div>
                  <p className="text-sm font-semibold text-primary">{formatCurrency(c.total)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(commissions.reduce((a, b) => a + b.total, 0))}</span>
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

