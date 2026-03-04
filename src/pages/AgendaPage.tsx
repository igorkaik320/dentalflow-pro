import { useState, useMemo } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockAppointments, mockProfessionals, mockPatients, mockProcedures, type Appointment } from "@/data/mockData";
import { Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusColors: Record<string, string> = {
  confirmed: "border-l-primary bg-primary/5",
  attended: "border-l-success bg-success/5",
  cancelled: "border-l-destructive bg-destructive/5",
  missed: "border-l-warning bg-warning/5",
};

const statusBadge: Record<string, string> = {
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

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getWeekDays(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const dayOfWeek = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day.toISOString().split("T")[0];
  });
}

function getMonthDays(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const days: (string | null)[] = [];
  for (let i = 0; i < (startDay === 0 ? 6 : startDay - 1); i++) days.push(null);
  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i).toISOString().split("T")[0]);
  }
  return days;
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [selectedDate, setSelectedDate] = useState("2026-03-04");
  const [selectedProfessional, setSelectedProfessional] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [showForm, setShowForm] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>("");

  const activeProfessionals = mockProfessionals.filter((p) => p.active);

  const filterAppointments = (date: string) => {
    return appointments.filter((a) => {
      const dateMatch = a.date === date;
      const profMatch = selectedProfessional === "all" || a.professionalId === selectedProfessional;
      const statusMatch = selectedStatus === "all" || a.status === selectedStatus;
      return dateMatch && profMatch && statusMatch;
    });
  };

  const filtered = filterAppointments(selectedDate);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);

  const handleDelete = () => {
    if (deleteId) {
      setAppointments(prev => prev.filter(a => a.id !== deleteId));
      toast.success("Agendamento excluído com sucesso");
      setDeleteId(null);
    }
  };

  const handleSave = () => {
    toast.success(editingApt ? "Agendamento atualizado" : "Agendamento criado com sucesso");
    setShowForm(false);
    setEditingApt(null);
    setSelectedProcedureId("");
  };

  const openEdit = (apt: Appointment) => {
    setEditingApt(apt);
    setSelectedProcedureId(apt.procedureId || "");
    setShowForm(true);
  };

  const openNew = () => {
    setEditingApt(null);
    setSelectedProcedureId("");
    setShowForm(true);
  };

  const navigateDate = (dir: number) => {
    if (view === "month") {
      const d = new Date(selectedDate + "T12:00:00");
      d.setMonth(d.getMonth() + dir);
      setSelectedDate(d.toISOString().split("T")[0]);
    } else if (view === "week") {
      setSelectedDate(addDays(selectedDate, dir * 7));
    } else {
      setSelectedDate(addDays(selectedDate, dir));
    }
  };

  const dateLabel = () => {
    const d = new Date(selectedDate + "T12:00:00");
    if (view === "month") return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (view === "week") {
      const days = getWeekDays(selectedDate);
      return `${new Date(days[0] + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} - ${new Date(days[6] + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  };

  const selectedProc = mockProcedures.find(p => p.id === selectedProcedureId);

  return (
    <ClinicLayout title="Agenda" subtitle="Gerenciamento de consultas">
      <div className="space-y-4 animate-fade-in">
        {/* Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-foreground min-w-[200px] text-center capitalize">{dateLabel()}</span>
              <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}>
                Hoje
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={view} onValueChange={(v) => setView(v as "day" | "week" | "month")}>
                <TabsList className="h-8">
                  <TabsTrigger value="day" className="text-xs px-3 h-6">Dia</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs px-3 h-6">Semana</TabsTrigger>
                  <TabsTrigger value="month" className="text-xs px-3 h-6">Mês</TabsTrigger>
                </TabsList>
              </Tabs>

              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos profissionais</SelectItem>
                  {activeProfessionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="attended">Compareceu</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="missed">Faltou</SelectItem>
                </SelectContent>
              </Select>

              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />
                Agendar
              </Button>
            </div>
          </div>
        </div>

        {/* Day View */}
        {view === "day" && (
          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-border">
              {timeSlots.map((time) => {
                const slotsAtTime = filtered.filter((a) => a.time === time);
                return (
                  <div key={time} className="flex min-h-[56px]">
                    <div className="w-16 shrink-0 flex items-start justify-center pt-3 text-xs font-medium text-muted-foreground border-r border-border bg-muted/30">
                      {time}
                    </div>
                    <div className="flex-1 p-1.5 space-y-1">
                      {slotsAtTime.map((apt) => (
                        <div
                          key={apt.id}
                          className={`p-2.5 rounded-md border-l-[3px] ${statusColors[apt.status]} group relative`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{apt.patientName}</p>
                              <p className="text-xs text-muted-foreground">{apt.procedure} • {apt.professionalName} • {apt.duration}min</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge[apt.status]}`}>
                                {statusLabels[apt.status]}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(apt)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteId(apt.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Week View */}
        {view === "week" && (
          <Card className="p-0 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-16 p-2 text-xs text-muted-foreground"></th>
                  {weekDays.map(day => {
                    const d = new Date(day + "T12:00:00");
                    const isToday = day === new Date().toISOString().split("T")[0];
                    return (
                      <th key={day} className={`p-2 text-center text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        <div>{d.toLocaleDateString("pt-BR", { weekday: "short" })}</div>
                        <div className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{d.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(time => (
                  <tr key={time} className="border-b border-border/50">
                    <td className="p-1 text-xs text-muted-foreground text-center border-r border-border bg-muted/30">{time}</td>
                    {weekDays.map(day => {
                      const dayApts = appointments.filter(a => {
                        const profMatch = selectedProfessional === "all" || a.professionalId === selectedProfessional;
                        const statusMatch = selectedStatus === "all" || a.status === selectedStatus;
                        return a.date === day && a.time === time && profMatch && statusMatch;
                      });
                      return (
                        <td key={day} className="p-0.5 align-top min-w-[100px]">
                          {dayApts.map(apt => (
                            <div
                              key={apt.id}
                              className={`p-1.5 rounded text-[10px] mb-0.5 border-l-2 ${statusColors[apt.status]} cursor-pointer`}
                              onClick={() => openEdit(apt)}
                            >
                              <p className="font-medium text-foreground truncate">{apt.patientName}</p>
                              <p className="text-muted-foreground truncate">{apt.procedure}</p>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Month View */}
        {view === "month" && (
          <Card className="p-0 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/50">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((day, i) => {
                const dayApts = day ? appointments.filter(a => {
                  const profMatch = selectedProfessional === "all" || a.professionalId === selectedProfessional;
                  const statusMatch = selectedStatus === "all" || a.status === selectedStatus;
                  return a.date === day && profMatch && statusMatch;
                }) : [];
                const isToday = day === new Date().toISOString().split("T")[0];
                const isSelected = day === selectedDate;
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] p-1 border-b border-r border-border/50 ${day ? 'cursor-pointer hover:bg-muted/30' : 'bg-muted/10'} ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => day && (setSelectedDate(day), setView("day"))}
                  >
                    {day && (
                      <>
                        <span className={`text-xs font-medium ${isToday ? 'bg-primary text-primary-foreground rounded-full px-1.5 py-0.5' : 'text-foreground'}`}>
                          {new Date(day + "T12:00:00").getDate()}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          {dayApts.slice(0, 3).map(apt => (
                            <div key={apt.id} className={`text-[9px] px-1 py-0.5 rounded truncate border-l-2 ${statusColors[apt.status]}`}>
                              {apt.time} {apt.patientName}
                            </div>
                          ))}
                          {dayApts.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">+{dayApts.length - 3} mais</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingApt(null); setSelectedProcedureId(""); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingApt ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2">
                <Label>Paciente</Label>
                <Select defaultValue={editingApt?.patientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                  <SelectContent>
                    {mockPatients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" defaultValue={editingApt?.date || selectedDate} />
              </div>
              <div>
                <Label>Horário</Label>
                <Select defaultValue={editingApt?.time}>
                  <SelectTrigger><SelectValue placeholder="Horário" /></SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Profissional</Label>
                <Select defaultValue={editingApt?.professionalId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {activeProfessionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select defaultValue={editingApt?.status || "confirmed"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="attended">Compareceu</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="missed">Faltou</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Procedimento pré-cadastrado</Label>
                <Select value={selectedProcedureId} onValueChange={setSelectedProcedureId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um procedimento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Procedimento personalizado</SelectItem>
                    {mockProcedures.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} - R$ {p.defaultPrice.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProc && (
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{selectedProc.averageDuration}min</span>
                    <span>R$ {selectedProc.defaultPrice.toFixed(2)}</span>
                  </div>
                )}
              </div>
              {(!selectedProcedureId || selectedProcedureId === "custom") && (
                <div className="col-span-2">
                  <Label>Procedimento (personalizado)</Label>
                  <Input placeholder="Descrição do procedimento" defaultValue={editingApt?.procedure} />
                </div>
              )}
              <div>
                <Label>Duração (min)</Label>
                <Input type="number" defaultValue={selectedProc?.averageDuration || editingApt?.duration || 30} />
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" defaultValue={selectedProc?.defaultPrice || editingApt?.value || ""} placeholder="0,00" />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea placeholder="Notas adicionais..." rows={2} defaultValue={editingApt?.notes} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingApt(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editingApt ? "Atualizar" : "Agendar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={() => setDeleteId(null)}
          title="Excluir Agendamento"
          description="Tem certeza que deseja excluir este agendamento?"
          onConfirm={handleDelete}
        />
      </div>
    </ClinicLayout>
  );
}
