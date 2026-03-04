import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockProfessionals } from "@/data/mockData";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const [showProfForm, setShowProfForm] = useState(false);

  return (
    <ClinicLayout title="Configurações" subtitle="Gerenciar sistema">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="professionals">
          <TabsList>
            <TabsTrigger value="professionals">Profissionais</TabsTrigger>
            <TabsTrigger value="clinic">Dados da Clínica</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="schedule">Horários</TabsTrigger>
          </TabsList>

          <TabsContent value="professionals">
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold">Profissionais Cadastrados</h3>
                <Dialog open={showProfForm} onOpenChange={setShowProfForm}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Novo Profissional</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="col-span-2"><Label>Nome</Label><Input placeholder="Nome completo" /></div>
                      <div><Label>Especialidade</Label><Input placeholder="Ortodontia" /></div>
                      <div><Label>Comissão (%)</Label><Input type="number" placeholder="40" /></div>
                      <div><Label>Telefone</Label><Input placeholder="(00) 00000-0000" /></div>
                      <div><Label>Email</Label><Input placeholder="email@clinica.com" /></div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setShowProfForm(false)}>Cancelar</Button>
                      <Button onClick={() => setShowProfForm(false)}>Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Nome</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Especialidade</th>
                      <th className="text-center text-xs font-medium text-muted-foreground p-3">Comissão</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Contato</th>
                      <th className="text-center text-xs font-medium text-muted-foreground p-3">Ativo</th>
                      <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockProfessionals.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 text-sm font-medium text-foreground">{p.name}</td>
                        <td className="p-3 text-sm text-muted-foreground">{p.specialty}</td>
                        <td className="p-3 text-sm text-center font-semibold text-primary">{p.commissionRate}%</td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{p.phone}</td>
                        <td className="p-3 text-center">
                          <Switch checked={p.active} />
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm"><Edit2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="clinic">
            <Card className="p-6 max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Dados da Clínica</h3>
                  <p className="text-xs text-muted-foreground">Informações exibidas nos documentos</p>
                </div>
              </div>
              <div className="space-y-4">
                <div><Label>Nome da Clínica</Label><Input defaultValue="OdontoSaaS Clínica" /></div>
                <div><Label>CNPJ</Label><Input defaultValue="12.345.678/0001-90" /></div>
                <div><Label>Telefone</Label><Input defaultValue="(11) 3456-7890" /></div>
                <div><Label>Email</Label><Input defaultValue="contato@odontosaas.com" /></div>
                <div><Label>Endereço</Label><Textarea defaultValue="Av. Paulista, 1000, Sala 501 - São Paulo/SP" rows={2} /></div>
                <div><Label>Logo</Label><Input type="file" accept="image/*" /></div>
                <Button>Salvar Alterações</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card className="p-5 max-w-md">
              <h3 className="text-sm font-semibold mb-4">Categorias Financeiras</h3>
              <div className="space-y-2">
                {["Material", "Fixo", "Utilidades", "Laboratório", "Marketing", "Outros"].map((cat) => (
                  <div key={cat} className="flex items-center justify-between p-2.5 rounded bg-secondary/50">
                    <span className="text-sm text-foreground">{cat}</span>
                    <Button variant="ghost" size="sm"><Edit2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar Categoria
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="p-5 max-w-md">
              <h3 className="text-sm font-semibold mb-4">Horários de Atendimento</h3>
              <div className="space-y-3">
                {[
                  { day: "Segunda a Sexta", start: "08:00", end: "18:00" },
                  { day: "Sábado", start: "08:00", end: "12:00" },
                  { day: "Domingo", start: "", end: "" },
                ].map((schedule) => (
                  <div key={schedule.day} className="flex items-center justify-between p-3 rounded bg-secondary/50">
                    <span className="text-sm font-medium text-foreground">{schedule.day}</span>
                    {schedule.start ? (
                      <span className="text-sm text-muted-foreground">{schedule.start} - {schedule.end}</span>
                    ) : (
                      <span className="text-xs text-destructive">Fechado</span>
                    )}
                  </div>
                ))}
              </div>
              <Button className="mt-4">Salvar Horários</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClinicLayout>
  );
}
