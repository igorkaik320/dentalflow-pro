import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockProcedures, type Procedure } from "@/data/mockData";
import { Plus, Edit2, Trash2, Clock, DollarSign, Stethoscope } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

export default function ProceduresPage() {
  const [procedures, setProcedures] = useState<Procedure[]>(mockProcedures);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleSave = () => {
    toast.success(editing ? "Procedimento atualizado" : "Procedimento cadastrado com sucesso");
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = () => {
    if (deleteId) {
      setProcedures(prev => prev.filter(p => p.id !== deleteId));
      toast.success("Procedimento excluído");
      setDeleteId(null);
    }
  };

  return (
    <ClinicLayout title="Procedimentos" subtitle={`${procedures.length} cadastrados`}>
      <div className="space-y-5 animate-fade-in">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Gerencie os procedimentos disponíveis para agendamento</p>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Procedimento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {procedures.map((proc) => (
            <Card key={proc.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground leading-tight">{proc.name}</h3>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(proc); setShowForm(true); }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteId(proc.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  R$ {proc.defaultPrice.toFixed(2)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {proc.averageDuration} min
                </span>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditing(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Procedimento" : "Novo Procedimento"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Nome do procedimento</Label>
                <Input placeholder="Ex: Clareamento Dental" defaultValue={editing?.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor padrão (R$)</Label>
                  <Input type="number" placeholder="0,00" defaultValue={editing?.defaultPrice} />
                </div>
                <div>
                  <Label>Duração média (min)</Label>
                  <Input type="number" placeholder="30" defaultValue={editing?.averageDuration} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={handleSave}>{editing ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={() => setDeleteId(null)}
          title="Excluir Procedimento"
          description="Tem certeza que deseja excluir este procedimento?"
          onConfirm={handleDelete}
        />
      </div>
    </ClinicLayout>
  );
}
