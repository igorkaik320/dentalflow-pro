import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mockPatients } from "@/data/mockData";
import { Search, Plus, Phone, Mail, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const filtered = mockPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.cpf.includes(search)
  );

  const selected = mockPatients.find((p) => p.id === selectedPatient);

  return (
    <ClinicLayout title="Pacientes" subtitle={`${mockPatients.length} cadastrados`}>
      <div className="space-y-4 animate-fade-in">
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                Novo Paciente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar Paciente</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="col-span-2">
                  <Label>Nome completo</Label>
                  <Input placeholder="Nome do paciente" />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label>Data de nascimento</Label>
                  <Input type="date" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input placeholder="email@exemplo.com" />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input placeholder="Rua, número, bairro, cidade/UF" />
                </div>
                <div className="col-span-2">
                  <Label>Observações</Label>
                  <Textarea placeholder="Alergias, condições especiais..." rows={3} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={() => setShowForm(false)}>Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Patient List */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3">CPF</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Telefone</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Email</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden lg:table-cell">Cadastro</th>
                  <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => (
                  <tr key={patient.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="text-sm font-medium text-foreground">{patient.name}</p>
                      {patient.notes && (
                        <p className="text-[10px] text-warning mt-0.5">⚠ {patient.notes}</p>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{patient.cpf}</td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />{patient.phone}
                      </span>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />{patient.email}
                      </span>
                    </td>
                    <td className="p-3 hidden lg:table-cell text-sm text-muted-foreground">
                      {new Date(patient.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPatient(patient.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Patient Detail Dialog */}
        <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected?.name}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{selected.cpf}</span></div>
                  <div><span className="text-muted-foreground">Nascimento:</span> <span className="font-medium">{new Date(selected.birthDate).toLocaleDateString("pt-BR")}</span></div>
                  <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{selected.phone}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selected.email}</span></div>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Endereço:</span>
                  <p className="font-medium">{selected.address}</p>
                </div>
                {selected.notes && (
                  <div className="text-sm p-2 rounded bg-warning/10 text-warning">
                    ⚠ {selected.notes}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ClinicLayout>
  );
}
