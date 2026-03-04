import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockAppointments, mockProfessionals } from "@/data/mockData";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState("2026-03-04");
  const [selectedProfessional, setSelectedProfessional] = useState("all");
  const [view, setView] = useState<"day" | "week">("day");
  const [showForm, setShowForm] = useState(false);

  const filtered = mockAppointments.filter((a) => {
    const dateMatch = a.date === selectedDate;
    const profMatch = selectedProfessional === "all" || a.professionalId === selectedProfessional;
    return dateMatch && profMatch;
  });

  const activeProfessionals = mockProfessionals.filter((p) => p.active);

  return (
    <ClinicLayout title="Agenda" subtitle="Gerenciamento de consultas">
      <div className="space-y-4 animate-fade-in">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split("T")[0]);
            }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[160px]"
            />
            <Button variant="outline" size="icon" onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split("T")[0]);
            }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground ml-2">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Profissional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {activeProfessionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={showForm} onOpenChange={setShowForm}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Agendar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Agendamento</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="col-span-2">
                    <Label>Paciente</Label>
                    <Input placeholder="Nome do paciente" />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" defaultValue={selectedDate} />
                  </div>
                  <div>
                    <Label>Horário</Label>
                    <Select>
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
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {activeProfessionals.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duração (min)</Label>
                    <Input type="number" defaultValue={30} />
                  </div>
                  <div className="col-span-2">
                    <Label>Procedimento</Label>
                    <Input placeholder="Descrição do procedimento" />
                  </div>
                  <div className="col-span-2">
                    <Label>Observações</Label>
                    <Textarea placeholder="Notas adicionais..." rows={2} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button onClick={() => setShowForm(false)}>Agendar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Timeline View */}
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-border">
            {timeSlots.map((time) => {
              const slotsAtTime = filtered.filter((a) => a.time === time);
              return (
                <div key={time} className="flex min-h-[60px]">
                  <div className="w-16 shrink-0 flex items-start justify-center pt-3 text-xs font-medium text-muted-foreground border-r border-border bg-muted/30">
                    {time}
                  </div>
                  <div className="flex-1 p-2 space-y-1">
                    {slotsAtTime.length > 0 ? (
                      slotsAtTime.map((apt) => (
                        <div
                          key={apt.id}
                          className={`p-2.5 rounded-md border-l-[3px] ${statusColors[apt.status]} cursor-pointer hover:shadow-sm transition-shadow`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{apt.patientName}</p>
                              <p className="text-xs text-muted-foreground">{apt.procedure} • {apt.professionalName} • {apt.duration}min</p>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge[apt.status]}`}>
                              {statusLabels[apt.status]}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </ClinicLayout>
  );
}
