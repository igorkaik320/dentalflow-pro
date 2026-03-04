import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockClinicalRecords, mockPatients } from "@/data/mockData";
import { Search, Plus, FileText, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockProfessionals } from "@/data/mockData";

export default function ClinicalRecordsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filtered = mockClinicalRecords.filter(
    (r) => r.patientName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ClinicLayout title="Prontuário Eletrônico" subtitle="Registros clínicos dos pacientes">
      <div className="space-y-4 animate-fade-in">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                Nova Evolução
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Evolução Clínica</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div>
                  <Label>Paciente</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {mockPatients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Profissional</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {mockProfessionals.filter(p => p.active).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição da evolução</Label>
                  <Textarea placeholder="Descreva o atendimento, procedimentos realizados, prescrições..." rows={6} />
                </div>
                <div>
                  <Label>Anexar arquivos</Label>
                  <Input type="file" multiple />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={() => setShowForm(false)}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {filtered.map((record) => (
            <Card key={record.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{record.patientName}</p>
                    <p className="text-xs text-muted-foreground">{record.professionalName} • {new Date(record.date).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed ml-10">{record.description}</p>
              {record.attachments.length > 0 && (
                <div className="flex items-center gap-2 mt-2 ml-10">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  {record.attachments.map((a) => (
                    <span key={a} className="text-xs text-primary underline cursor-pointer">{a}</span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </ClinicLayout>
  );
}
