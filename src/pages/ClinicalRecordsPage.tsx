import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockClinicalRecords, mockPatients, mockProfessionals, type ClinicalRecord } from "@/data/mockData";
import { Search, Plus, FileText, Paperclip, Edit2, Trash2, Stethoscope, ClipboardList, Pill, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ClinicalRecordsPage() {
  const [records, setRecords] = useState<ClinicalRecord[]>(mockClinicalRecords);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = records.filter(
    (r) => r.patientName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    toast.success(editingRecord ? "Prontuário atualizado com sucesso" : "Evolução registrada com sucesso");
    setShowForm(false);
    setEditingRecord(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      setRecords(prev => prev.filter(r => r.id !== deleteId));
      toast.success("Registro excluído com sucesso");
      setDeleteId(null);
    }
  };

  const openEdit = (record: ClinicalRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const openNew = () => {
    setEditingRecord(null);
    setShowForm(true);
  };

  return (
    <ClinicLayout title="Prontuário Eletrônico" subtitle="Registros clínicos dos pacientes">
      <div className="space-y-5 animate-fade-in">
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
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nova Evolução
          </Button>
        </div>

        <div className="space-y-3">
          {filtered.sort((a, b) => b.date.localeCompare(a.date)).map((record) => (
            <Card key={record.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{record.patientName}</p>
                    <p className="text-xs text-muted-foreground">{record.professionalName} • {new Date(record.date).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(record)} title="Editar">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(record.id)} title="Excluir" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="ml-[52px] space-y-2.5">
                {record.complaint && (
                  <div className="flex items-start gap-2">
                    <ClipboardList className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Queixa Principal</p>
                      <p className="text-sm text-foreground/80">{record.complaint}</p>
                    </div>
                  </div>
                )}
                {record.diagnosis && (
                  <div className="flex items-start gap-2">
                    <Stethoscope className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Diagnóstico</p>
                      <p className="text-sm text-foreground/80">{record.diagnosis}</p>
                    </div>
                  </div>
                )}
                {record.procedurePerformed && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Procedimento Realizado</p>
                      <p className="text-sm text-foreground/80">{record.procedurePerformed}</p>
                    </div>
                  </div>
                )}
                {record.prescription && (
                  <div className="flex items-start gap-2">
                    <Pill className="h-3.5 w-3.5 text-info mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prescrição</p>
                      <p className="text-sm text-foreground/80">{record.prescription}</p>
                    </div>
                  </div>
                )}
                {record.observations && (
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Observações</p>
                      <p className="text-sm text-foreground/80">{record.observations}</p>
                    </div>
                  </div>
                )}
                {record.attachments.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    {record.attachments.map((a) => (
                      <Badge key={a} variant="secondary" className="text-xs cursor-pointer hover:bg-secondary">{a}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingRecord(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Editar Evolução Clínica" : "Registrar Evolução Clínica"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Paciente</Label>
                  <Select defaultValue={editingRecord?.patientId}>
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
                  <Select defaultValue={editingRecord?.professionalId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {mockProfessionals.filter(p => p.active).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <Label>Queixa principal</Label>
                <Input placeholder="Qual a queixa do paciente?" defaultValue={editingRecord?.complaint} />
              </div>
              <div>
                <Label>Diagnóstico</Label>
                <Input placeholder="Diagnóstico clínico" defaultValue={editingRecord?.diagnosis} />
              </div>
              <div>
                <Label>Procedimento realizado</Label>
                <Textarea placeholder="Descreva detalhadamente o procedimento realizado..." rows={3} defaultValue={editingRecord?.procedurePerformed} />
              </div>
              <div>
                <Label>Prescrição</Label>
                <Textarea placeholder="Medicamentos, posologia e duração..." rows={2} defaultValue={editingRecord?.prescription} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea placeholder="Notas adicionais, retorno, encaminhamentos..." rows={2} defaultValue={editingRecord?.observations} />
              </div>
              <div>
                <Label>Anexar arquivos</Label>
                <Input type="file" multiple />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingRecord(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editingRecord ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={() => setDeleteId(null)}
          title="Excluir Registro"
          description="Tem certeza que deseja excluir este registro clínico? Esta ação não pode ser desfeita."
          onConfirm={handleDelete}
        />
      </div>
    </ClinicLayout>
  );
}
