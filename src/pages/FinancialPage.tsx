import { useState } from "react";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  mockReceivables, mockPayables, mockProfessionals,
  type Receivable, type Payable,
} from "@/data/mockData";
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Plus, Edit2, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const statusBadge: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};
const statusLabel: Record<string, string> = {
  open: "Aberto", paid: "Pago", overdue: "Atrasado",
};

export default function FinancialPage() {
  const [receivables, setReceivables] = useState<Receivable[]>(mockReceivables);
  const [payables, setPayables] = useState<Payable[]>(mockPayables);

  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRec, setEditingRec] = useState<Receivable | null>(null);
  const [deleteRecId, setDeleteRecId] = useState<string | null>(null);

  const [showPayForm, setShowPayForm] = useState(false);
  const [editingPay, setEditingPay] = useState<Payable | null>(null);
  const [deletePayId, setDeletePayId] = useState<string | null>(null);

  const totalReceivables = receivables.reduce((a, b) => a + b.amount, 0);
  const totalPaid = receivables.filter(r => r.status === 'paid').reduce((a, b) => a + b.amount, 0);
  const totalPayables = payables.reduce((a, b) => a + b.amount, 0);

  return (
    <ClinicLayout title="Financeiro" subtitle="Controle financeiro completo">
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center"><ArrowUpCircle className="h-5 w-5 text-success" /></div>
              <div><p className="text-xs text-muted-foreground">A Receber</p><p className="text-xl font-bold text-foreground">{formatCurrency(totalReceivables)}</p></div>
            </div>
          </Card>
          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">Recebido</p><p className="text-xl font-bold text-foreground">{formatCurrency(totalPaid)}</p></div>
            </div>
          </Card>
          <Card className="stat-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-xs text-muted-foreground">A Pagar</p><p className="text-xl font-bold text-foreground">{formatCurrency(totalPayables)}</p></div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="receivables">
          <TabsList>
            <TabsTrigger value="receivables">Contas a Receber</TabsTrigger>
            <TabsTrigger value="payables">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
            <TabsTrigger value="cashflow">Caixa</TabsTrigger>
          </TabsList>

          {/* ═══════ CONTAS A RECEBER ═══════ */}
          <TabsContent value="receivables">
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold">Contas a Receber</h3>
                <Button size="sm" onClick={() => { setEditingRec(null); setShowRecForm(true); }}><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Paciente</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Procedimento</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Profissional</th>
                      <th className="text-right text-xs font-medium text-muted-foreground p-3">Valor</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Pagamento</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Vencimento</th>
                      <th className="text-center text-xs font-medium text-muted-foreground p-3">Status</th>
                      <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 text-sm font-medium text-foreground">{r.patientName}</td>
                        <td className="p-3 text-sm text-muted-foreground">{r.procedure}</td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{r.professionalName}</td>
                        <td className="p-3 text-sm font-semibold text-foreground text-right">{formatCurrency(r.amount)}</td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{r.paymentMethod}{r.installments > 1 ? ` (${r.installments}x)` : ""}</td>
                        <td className="p-3 text-sm text-muted-foreground">{new Date(r.dueDate).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusBadge[r.status]}`}>{statusLabel[r.status]}</span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingRec(r); setShowRecForm(true); }}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteRecId(r.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ═══════ CONTAS A PAGAR ═══════ */}
          <TabsContent value="payables">
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold">Contas a Pagar</h3>
                <Button size="sm" onClick={() => { setEditingPay(null); setShowPayForm(true); }}><Plus className="h-3.5 w-3.5 mr-1" />Novo</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Fornecedor</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Descrição</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3 hidden md:table-cell">Categoria</th>
                      <th className="text-right text-xs font-medium text-muted-foreground p-3">Valor</th>
                      <th className="text-left text-xs font-medium text-muted-foreground p-3">Vencimento</th>
                      <th className="text-center text-xs font-medium text-muted-foreground p-3">Status</th>
                      <th className="text-right text-xs font-medium text-muted-foreground p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payables.map(p => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 text-sm font-medium text-foreground">{p.supplier}</td>
                        <td className="p-3 text-sm text-muted-foreground">{p.description}</td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{p.category}</td>
                        <td className="p-3 text-sm font-semibold text-foreground text-right">{formatCurrency(p.amount)}</td>
                        <td className="p-3 text-sm text-muted-foreground">{new Date(p.dueDate).toLocaleDateString("pt-BR")}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusBadge[p.status]}`}>{statusLabel[p.status]}</span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingPay(p); setShowPayForm(true); }}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeletePayId(p.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Commissions */}
          <TabsContent value="commissions">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Comissões por Profissional</h3>
              <div className="space-y-4">
                {mockProfessionals.filter(p => p.active).map(prof => {
                  const profReceivables = receivables.filter(r => r.professionalId === prof.id && r.status === 'paid');
                  const totalBilled = profReceivables.reduce((a, b) => a + b.amount, 0);
                  const commission = totalBilled * (prof.commissionRate / 100);
                  return (
                    <div key={prof.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{prof.name}</p>
                        <p className="text-xs text-muted-foreground">{prof.specialty} • {prof.commissionRate}% comissão</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Faturado: {formatCurrency(totalBilled)}</p>
                        <p className="text-sm font-bold text-primary">Comissão: {formatCurrency(commission)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cashflow">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Controle de Caixa - 04/03/2026</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Abrir Caixa</Button>
                  <Button size="sm" variant="destructive">Fechar Caixa</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-muted/50 text-center"><p className="text-xs text-muted-foreground">Saldo Inicial</p><p className="text-lg font-bold text-foreground">{formatCurrency(500)}</p></div>
                <div className="p-3 rounded-lg bg-success/10 text-center"><p className="text-xs text-muted-foreground">Entradas</p><p className="text-lg font-bold text-success">{formatCurrency(2350)}</p></div>
                <div className="p-3 rounded-lg bg-destructive/10 text-center"><p className="text-xs text-muted-foreground">Saídas</p><p className="text-lg font-bold text-destructive">{formatCurrency(680)}</p></div>
                <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-xs text-muted-foreground">Saldo Final</p><p className="text-lg font-bold text-primary">{formatCurrency(2170)}</p></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 rounded bg-success/5 border-l-2 border-success">
                  <div><p className="text-sm font-medium text-foreground">Consulta - Ana Costa</p><p className="text-xs text-muted-foreground">Pix • Dra. Ana Silva</p></div>
                  <p className="text-sm font-semibold text-success">+ {formatCurrency(200)}</p>
                </div>
                <div className="flex justify-between items-center p-3 rounded bg-success/5 border-l-2 border-success">
                  <div><p className="text-sm font-medium text-foreground">Manutenção ortodôntica - Maria Oliveira</p><p className="text-xs text-muted-foreground">Cartão Crédito • Dra. Ana Silva</p></div>
                  <p className="text-sm font-semibold text-success">+ {formatCurrency(350)}</p>
                </div>
                <div className="flex justify-between items-center p-3 rounded bg-destructive/5 border-l-2 border-destructive">
                  <div><p className="text-sm font-medium text-foreground">Material de escritório</p><p className="text-xs text-muted-foreground">Dinheiro</p></div>
                  <p className="text-sm font-semibold text-destructive">- {formatCurrency(80)}</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ═══════ RECEIVABLE FORM ═══════ */}
        <Dialog open={showRecForm} onOpenChange={open => { setShowRecForm(open); if (!open) setEditingRec(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingRec ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2"><Label>Paciente</Label><Input placeholder="Nome" defaultValue={editingRec?.patientName} /></div>
              <div className="col-span-2"><Label>Procedimento</Label><Input placeholder="Procedimento" defaultValue={editingRec?.procedure} /></div>
              <div><Label>Valor</Label><Input type="number" placeholder="0,00" defaultValue={editingRec?.amount} /></div>
              <div><Label>Parcelas</Label><Input type="number" defaultValue={editingRec?.installments || 1} /></div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select defaultValue={editingRec?.paymentMethod?.toLowerCase().replace(/\s/g, '_') || ''}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cartão_crédito">Cartão Crédito</SelectItem>
                    <SelectItem value="cartão_débito">Cartão Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Vencimento</Label><Input type="date" defaultValue={editingRec?.dueDate} /></div>
              <div className="col-span-2">
                <Label>Status</Label>
                <Select defaultValue={editingRec?.status || 'open'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowRecForm(false); setEditingRec(null); }}>Cancelar</Button>
              <Button onClick={() => { toast.success(editingRec ? "Conta atualizada" : "Conta registrada"); setShowRecForm(false); setEditingRec(null); }}>{editingRec ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══════ PAYABLE FORM ═══════ */}
        <Dialog open={showPayForm} onOpenChange={open => { setShowPayForm(open); if (!open) setEditingPay(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingPay ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2"><Label>Fornecedor</Label><Input placeholder="Nome" defaultValue={editingPay?.supplier} /></div>
              <div className="col-span-2"><Label>Descrição</Label><Input placeholder="Descrição" defaultValue={editingPay?.description} /></div>
              <div>
                <Label>Categoria</Label>
                <Select defaultValue={editingPay?.category?.toLowerCase() || ''}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="utilidades">Utilidades</SelectItem>
                    <SelectItem value="laboratório">Laboratório</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor</Label><Input type="number" placeholder="0,00" defaultValue={editingPay?.amount} /></div>
              <div><Label>Vencimento</Label><Input type="date" defaultValue={editingPay?.dueDate} /></div>
              <div>
                <Label>Status</Label>
                <Select defaultValue={editingPay?.status || 'open'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowPayForm(false); setEditingPay(null); }}>Cancelar</Button>
              <Button onClick={() => { toast.success(editingPay ? "Conta atualizada" : "Conta registrada"); setShowPayForm(false); setEditingPay(null); }}>{editingPay ? "Atualizar" : "Salvar"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirm Dialogs */}
        <ConfirmDialog open={!!deleteRecId} onOpenChange={() => setDeleteRecId(null)} title="Excluir Conta a Receber" description="Tem certeza que deseja excluir esta conta?" onConfirm={() => { setReceivables(prev => prev.filter(r => r.id !== deleteRecId)); toast.success("Conta excluída"); setDeleteRecId(null); }} />
        <ConfirmDialog open={!!deletePayId} onOpenChange={() => setDeletePayId(null)} title="Excluir Conta a Pagar" description="Tem certeza que deseja excluir esta conta?" onConfirm={() => { setPayables(prev => prev.filter(p => p.id !== deletePayId)); toast.success("Conta excluída"); setDeletePayId(null); }} />
      </div>
    </ClinicLayout>
  );
}
