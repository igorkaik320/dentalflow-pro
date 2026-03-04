import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { dashboardStats, mockAppointments } from "@/data/mockData";
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
  LineChart,
  Line,
} from "recharts";

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

export default function DashboardPage() {
  const todayAppointments = mockAppointments.filter((a) => a.date === "2026-03-04");

  const stats = [
    { label: "Faturamento Mensal", value: formatCurrency(dashboardStats.monthlyRevenue), icon: DollarSign, trend: "+12%", up: true },
    { label: "Total Recebido", value: formatCurrency(dashboardStats.totalReceived), icon: TrendingUp, trend: "+8%", up: true },
    { label: "Em Aberto", value: formatCurrency(dashboardStats.totalOpen), icon: Clock, trend: "-5%", up: false },
    { label: "Pacientes Novos", value: dashboardStats.newPatients.toString(), icon: Users, trend: "+3", up: true },
  ];

  return (
    <ClinicLayout title="Dashboard" subtitle="Visão geral da clínica">
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {stat.up ? (
                  <ArrowUpRight className="h-3 w-3 text-success" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                <span className={`text-xs font-medium ${stat.up ? "text-success" : "text-destructive"}`}>
                  {stat.trend}
                </span>
                <span className="text-xs text-muted-foreground">vs mês anterior</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2 p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Evolução Mensal</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dashboardStats.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Receita" />
                <Bar dataKey="expenses" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Commissions */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Comissões do Mês</h3>
            <div className="space-y-4">
              {dashboardStats.commissions.map((c) => (
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
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(dashboardStats.commissions.reduce((a, b) => a + b.total, 0))}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Today's Appointments */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Agenda de Hoje</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              04/03/2026
            </div>
          </div>
          <div className="space-y-2">
            {todayAppointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[50px]">
                    <p className="text-sm font-semibold text-foreground">{apt.time}</p>
                    <p className="text-[10px] text-muted-foreground">{apt.duration}min</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{apt.patientName}</p>
                    <p className="text-xs text-muted-foreground">{apt.procedure} • {apt.professionalName}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[apt.status]}`}>
                  {statusLabels[apt.status]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </ClinicLayout>
  );
}
