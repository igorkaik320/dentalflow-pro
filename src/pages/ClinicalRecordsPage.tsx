import { useEffect, useMemo, useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useClinic } from "@/contexts/ClinicContext";
import { db, uploadClinicalAttachment } from "@/lib/clinicCloud";

type PatientOption = {
  id: string;
  name: string;
};

type ProfessionalOption = {
  id: string;
  name: string;
  active: boolean;
};

type AttachmentInfo = {
  name: string;
  url: string;
};

type ClinicalRecord = {
  id: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  professionalName: string;
  date: string;
  complaint: string;
  diagnosis: string;
  procedurePerformed: string;
  prescription: string;
  observations: string;
  attachments: AttachmentInfo[];
};

type RecordForm = {
  patientId: string;
  professionalId: string;
  date: string;
  complaint: string;
  diagnosis: string;
  procedurePerformed: string;
  prescription: string;
  observations: string;
  attachments: AttachmentInfo[];
};

const emptyForm: RecordForm = {
  patientId: "",
  professionalId: "none",
  date: new Date().toISOString().split("T")[0],
  complaint: "",
  diagnosis: "",
  procedurePerformed: "",
  prescription: "",
  observations: "",
  attachments: [],
};

function parseAttachment(value: string): AttachmentInfo {
  try {
    const parsed = JSON.parse(value);
    if (parsed?.name && parsed?.url) return parsed;
  } catch {
    // Older records stored only the filename.
  }
  return { name: value, url: "" };
}

function serializeAttachment(attachment: AttachmentInfo) {
  return JSON.stringify(attachment);
}

function mapRecord(row: any): ClinicalRecord {
  return {
    id: row.id,
    patientId: row.patient_id || "",
    patientName: row.patient_name || "",
    professionalId: row.professional_id || "",
    professionalName: row.professional_name || "",
    date: row.record_date || row.created_at || new Date().toISOString(),
    complaint: row.complaint || "",
    diagnosis: row.diagnosis || "",
    procedurePerformed: row.procedure_performed || "",
    prescription: row.prescription || "",
    observations: row.observations || "",
    attachments: (row.attachments || []).map(parseAttachment),
  };
}

export default function ClinicalRecordsPage() {
  const { clinic } = useClinic();
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RecordForm>(emptyForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(
    () => records.filter((r) => r.patientName.toLowerCase().includes(search.toLowerCase())),
    [records, search]
  );

  useEffect(() => {
    if (!clinic.id) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [clinic.id]);

  const loadData = async () => {
    if (!clinic.id) return;
    setLoading(true);
    const [recordRes, patientRes, professionalRes] = await Promise.all([
      db.from("clinical_records").select("*").eq("clinic_id", clinic.id).order("record_date", { ascending: false }).order("created_at", { ascending: false }),
      db.from("patients").select("id, name").eq("clinic_id", clinic.id).order("name"),
      db.from("professionals").select("id, name, active").eq("clinic_id", clinic.id).order("name"),
    ]);
    setLoading(false);

    const error = recordRes.error || patientRes.error || professionalRes.error;
    if (error) {
      toast.error("Não foi possível carregar os prontuários. Verifique se a migration clinical_records foi aplicada.");
      return;
    }

    setRecords((recordRes.data || []).map(mapRecord));
    setPatients((patientRes.data || []).map((p: any) => ({ id: p.id, name: p.name || "" })));
    setProfessionals((professionalRes.data || []).map((p: any) => ({ id: p.id, name: p.name || "", active: Boolean(p.active) })));
  };

  const handleSave = async () => {
    if (!clinic.id) return toast.error("Clínica não vinculada. Verifique o cadastro da clínica atualizados.");
    const patient = patients.find((p) => p.id === form.patientId);
    if (!patient) return toast.error("Selecione um paciente cadastrado.");

    const professional = professionals.find((p) => p.id === form.professionalId);
    setSaving(true);
    let attachments = [...form.attachments];
    try {
      if (selectedFiles.length > 0) {
        const uploaded = await Promise.all(selectedFiles.map((file) => uploadClinicalAttachment(clinic.id!, file)));
        attachments = [...attachments, ...uploaded];
      }
    } catch {
      setSaving(false);
      return toast.error("Não foi possível enviar os anexos.");
    }

    const payload = {
      clinic_id: clinic.id,
      patient_id: patient.id,
      patient_name: patient.name,
      professional_id: professional?.id || null,
      professional_name: professional?.name || "",
      record_date: form.date,
      complaint: form.complaint,
      diagnosis: form.diagnosis,
      procedure_performed: form.procedurePerformed,
      prescription: form.prescription,
      observations: form.observations,
      attachments: attachments.map(serializeAttachment),
    };

    const query = editingRecord
      ? db.from("clinical_records").update(payload).eq("id", editingRecord.id).eq("clinic_id", clinic.id).select().single()
      : db.from("clinical_records").insert(payload).select().single();

    const { data, error } = await query;
    setSaving(false);
    if (error) return toast.error("Não foi possível salvar o prontuário.");

    const saved = mapRecord(data);
    setRecords((prev) => editingRecord
      ? prev.map((record) => record.id === saved.id ? saved : record)
      : [saved, ...prev]
    );
    toast.success(editingRecord ? "Prontuário atualizado com sucesso" : "Evolução registrada com sucesso");
    setShowForm(false);
    setEditingRecord(null);
    setForm(emptyForm);
    setSelectedFiles([]);
  };

  const handleDelete = async () => {
    if (!clinic.id || !deleteId) return;
    const { error } = await db.from("clinical_records").delete().eq("id", deleteId).eq("clinic_id", clinic.id);
    if (error) return toast.error("Não foi possível excluir o registro clínico.");
    setRecords((prev) => prev.filter((r) => r.id !== deleteId));
    toast.success("Registro excluído com sucesso");
    setDeleteId(null);
  };

  const openEdit = (record: ClinicalRecord) => {
    setEditingRecord(record);
    setForm({
      patientId: record.patientId,
      professionalId: record.professionalId || "none",
      date: record.date.split("T")[0],
      complaint: record.complaint,
      diagnosis: record.diagnosis,
      procedurePerformed: record.procedurePerformed,
      prescription: record.prescription,
      observations: record.observations,
      attachments: record.attachments,
    });
    setSelectedFiles([]);
    setShowForm(true);
  };

  const openNew = () => {
    setEditingRecord(null);
    setForm(emptyForm);
    setSelectedFiles([]);
    setShowForm(true);
  };

  return (
    <ClinicLayout title="Prontuário Eletrônico" subtitle="Registros clínicos dos pacientes integrados ao sistema">
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
          {loading && (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando prontuários...</Card>
          )}
          {!loading && filtered.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum prontuário encontrado.</Card>
          )}
          {!loading && filtered.map((record) => (
            <Card key={record.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{record.patientName}</p>
                    <p className="text-xs text-muted-foreground">{record.professionalName || "Sem profissional"} • {new Date(record.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
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
                {record.complaint && <RecordLine icon={<ClipboardList className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />} label="Queixa Principal" value={record.complaint} />}
                {record.diagnosis && <RecordLine icon={<Stethoscope className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />} label="Diagnóstico" value={record.diagnosis} />}
                {record.procedurePerformed && <RecordLine icon={<FileText className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />} label="Procedimento Realizado" value={record.procedurePerformed} />}
                {record.prescription && <RecordLine icon={<Pill className="h-3.5 w-3.5 text-info mt-0.5 shrink-0" />} label="Prescrição" value={record.prescription} />}
                {record.observations && <RecordLine icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />} label="Observações" value={record.observations} />}
                {record.attachments.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    {record.attachments.map((a) => (
                      <Badge key={`${a.name}-${a.url}`} variant="secondary" className="text-xs">
                        {a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a> : a.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingRecord(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Editar Evolução Clínica" : "Registrar Evolução Clínica"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Paciente</Label>
                  <Select value={form.patientId} onValueChange={(patientId) => setForm((prev) => ({ ...prev, patientId }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Profissional</Label>
                  <Select value={form.professionalId} onValueChange={(professionalId) => setForm((prev) => ({ ...prev, professionalId }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem profissional</SelectItem>
                      {professionals.filter((p) => p.active).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
                </div>
              </div>

              <Separator />

              <div>
                <Label>Queixa principal</Label>
                <Input placeholder="Qual a queixa do paciente?" value={form.complaint} onChange={(e) => setForm((prev) => ({ ...prev, complaint: e.target.value }))} />
              </div>
              <div>
                <Label>Diagnóstico</Label>
                <Input placeholder="Diagnóstico clínico" value={form.diagnosis} onChange={(e) => setForm((prev) => ({ ...prev, diagnosis: e.target.value }))} />
              </div>
              <div>
                <Label>Procedimento realizado</Label>
                <Textarea placeholder="Descreva detalhadamente o procedimento realizado..." rows={3} value={form.procedurePerformed} onChange={(e) => setForm((prev) => ({ ...prev, procedurePerformed: e.target.value }))} />
              </div>
              <div>
                <Label>Prescrição</Label>
                <Textarea placeholder="Medicamentos, posologia e duração..." rows={2} value={form.prescription} onChange={(e) => setForm((prev) => ({ ...prev, prescription: e.target.value }))} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea placeholder="Notas adicionais, retorno, encaminhamentos..." rows={2} value={form.observations} onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))} />
              </div>
              <div>
                <Label>Anexar arquivos</Label>
                <Input type="file" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} />
                {form.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.attachments.map((attachment) => (
                      <Badge key={`${attachment.name}-${attachment.url}`} variant="secondary" className="text-xs">
                        {attachment.url ? <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a> : attachment.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedFiles.length} arquivo(s) novo(s) selecionado(s)</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingRecord(null); setSelectedFiles([]); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : editingRecord ? "Atualizar" : "Salvar"}</Button>
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

function RecordLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground/80">{value}</p>
      </div>
    </div>
  );
}

