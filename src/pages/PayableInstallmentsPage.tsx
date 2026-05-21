import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FilterX, FileText } from "lucide-react";
import { toast } from "sonner";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency } from "@/lib/utils";

type InstallmentStatus = "open" | "paid" | "overdue";

type InstallmentView = {
  id: string;
  payableId: string;
  supplier: string;
  description: string;
  category: string;
  companyName: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: InstallmentStatus;
  notes: string;
  dayKey: string;
  dayLabel: string;
};

type DayGroup = {
  key: string;
  label: string;
  total: number;
  count: number;
  items: InstallmentView[];
};

const statusLabel: Record<InstallmentStatus, string> = {
  open: "Aberta",
  paid: "Paga",
  overdue: "Atrasada",
};

const statusClass: Record<InstallmentStatus, string> = {
  open: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateText: string) {
  if (!dateText) return "-";
  return new Date(`${dateText}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatLongDay(dateText: string) {
  if (!dateText) return "Sem vencimento";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${dateText}T12:00:00`));
}

function normalizeStatus(status: string, dueDate: string): InstallmentStatus {
  if (status === "paid") return "paid";
  if (status === "overdue") return "overdue";
  return dueDate && dueDate < today() ? "overdue" : "open";
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function inPeriod(dateText: string, start: string, end: string) {
  if (!dateText) return false;
  if (start && dateText < start) return false;
  if (end && dateText > end) return false;
  return true;
}

function mapRows(rows: any[]): InstallmentView[] {
  return rows.flatMap((payable) => {
    const installments = payable.payable_installments || [];
    if (installments.length === 0) {
      const dueDate = payable.due_date || payable.first_due_date || today();
      const status = normalizeStatus(payable.status || "open", dueDate);
      return [{
        id: `payable-${payable.id}`,
        payableId: payable.id,
        supplier: payable.supplier || "Fornecedor nao informado",
        description: payable.description || "Conta a pagar",
        category: payable.category || "",
        companyName: payable.company_name || "",
        installmentNumber: 1,
        amount: Number(payable.amount || 0),
        dueDate,
        paidDate: payable.paid_date || undefined,
        status,
        notes: payable.source_notes || "",
        dayKey: dueDate,
        dayLabel: formatLongDay(dueDate),
      }];
    }

    return installments.map((installment: any) => {
      const dueDate = installment.due_date || payable.due_date || payable.first_due_date || today();
      const status = normalizeStatus(installment.status || payable.status || "open", dueDate);
      return {
        id: installment.id,
        payableId: payable.id,
        supplier: payable.supplier || "Fornecedor nao informado",
        description: payable.description || "Conta a pagar",
        category: payable.category || "",
        companyName: payable.company_name || "",
        installmentNumber: Number(installment.installment_number || 1),
        amount: Number(installment.amount || 0),
        dueDate,
        paidDate: installment.paid_date || undefined,
        status,
        notes: installment.notes || payable.source_notes || "",
        dayKey: dueDate,
        dayLabel: formatLongDay(dueDate),
      };
    });
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.amount - b.amount || a.supplier.localeCompare(b.supplier));
}

export default function PayableInstallmentsPage() {
  const { clinic } = useClinic();
  const [items, setItems] = useState<InstallmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"all" | InstallmentStatus>("open");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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
    const { data, error } = await db
      .from("payables")
      .select("id, supplier, description, category, amount, due_date, status, paid_date, first_due_date, company_name, source_notes, payable_installments(id, installment_number, amount, due_date, paid_date, paid_amount, status, notes)")
      .eq("clinic_id", clinic.id)
      .order("due_date", { ascending: true });

    setLoading(false);
    if (error) return toast.error("Nao foi possivel carregar as parcelas a pagar.");
    setItems(mapRows(data || []));
  };

  const companyOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.companyName).filter(Boolean))).sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    const term = normalizeText(search);
    return items.filter((item) => {
      const text = normalizeText(`${item.supplier} ${item.description} ${item.category} ${item.companyName} ${item.notes}`);
      const matchesSearch = !term || text.includes(term);
      const matchesCompany = !company || item.companyName === company;
      const matchesStatus = status === "all" || item.status === status;
      const matchesPeriod = inPeriod(item.dueDate, startDate, endDate);
      return matchesSearch && matchesCompany && matchesStatus && matchesPeriod;
    });
  }, [company, endDate, items, search, startDate, status]);

  const total = useMemo(() => visibleItems.reduce((sum, item) => sum + item.amount, 0), [visibleItems]);
  const overdueTotal = useMemo(() => visibleItems.filter((item) => item.status === "overdue").reduce((sum, item) => sum + item.amount, 0), [visibleItems]);
  const paidTotal = useMemo(() => visibleItems.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0), [visibleItems]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const item of visibleItems) {
      const current = map.get(item.dayKey);
      if (current) {
        current.total += item.amount;
        current.count += 1;
        current.items.push(item);
        current.items.sort((a, b) => a.amount - b.amount || a.supplier.localeCompare(b.supplier));
      } else {
        map.set(item.dayKey, { key: item.dayKey, label: item.dayLabel, total: item.amount, count: 1, items: [item] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [visibleItems]);

  const clearFilters = () => {
    setSearch("");
    setCompany("");
    setStatus("open");
    setStartDate("");
    setEndDate("");
  };

  const exportPdf = async () => {
    if (exporting) return;
    if (!reportRef.current || visibleItems.length === 0) return toast.error("Nao ha parcelas para exportar.");

    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let remainingHeight = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
      remainingHeight -= pageHeight;
      while (remainingHeight > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
        remainingHeight -= pageHeight;
      }

      const safePeriod = `${startDate || "inicio"}_${endDate || "fim"}`.replace(/[^\w-]/g, "");
      pdf.save(`parcelas_contas_pagar_${safePeriod}.pdf`);
      toast.success("PDF gerado com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Nao foi possivel gerar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ClinicLayout title="Parcelas a Pagar" subtitle="Relatorio por vencimento das contas a pagar">
      <div className="space-y-5 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Total filtrado</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(total)}</p>
          </Card>
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Atrasadas</p>
            <p className="text-2xl font-bold text-destructive mt-1">{formatCurrency(overdueTotal)}</p>
          </Card>
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Pagas no filtro</p>
            <p className="text-2xl font-bold text-success mt-1">{formatCurrency(paidTotal)}</p>
          </Card>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_190px_160px_160px_160px] gap-3">
            <div>
              <Label>Pesquisar</Label>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Fornecedor, descricao ou observacao" />
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={company || "all"} onValueChange={(value) => setCompany(value === "all" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companyOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(value: "all" | InstallmentStatus) => setStatus(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abertas</SelectItem>
                  <SelectItem value="overdue">Atrasadas</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data inicial</Label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <Label>Data final</Label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
            <Button variant="outline" onClick={clearFilters}><FilterX className="h-4 w-4 mr-2" />Limpar filtros</Button>
            <Button onClick={exportPdf} disabled={exporting || visibleItems.length === 0}><Download className="h-4 w-4 mr-2" />{exporting ? "Gerando..." : "Gerar PDF"}</Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parcelas por vencimento</CardTitle>
            <CardDescription>{loading ? "Carregando parcelas..." : `${visibleItems.length} parcelas encontradas`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={reportRef} className="bg-white text-slate-950 p-4 rounded-md">
              <div className="mb-4 border rounded-md p-4">
                <div className="flex items-center gap-2 text-primary">
                  <FileText className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-[0.2em]">Relatorio financeiro</p>
                </div>
                <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">Parcelas de contas a pagar</h2>
                    <p className="text-sm text-slate-500">{clinic.name}</p>
                  </div>
                  <div className="text-sm text-slate-600 md:text-right">
                    <p>Periodo: {startDate ? formatDate(startDate) : "Inicio"} a {endDate ? formatDate(endDate) : "Fim"}</p>
                    <p>Status: {status === "all" ? "Todos" : statusLabel[status]}</p>
                  </div>
                </div>
              </div>

              {dayGroups.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">Nenhuma parcela encontrada.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Observacao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayGroups.map((group) => [
                      <TableRow key={group.key} className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={6}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-950">{group.label}</p>
                              <p className="text-xs text-slate-500">{group.count} parcela{group.count === 1 ? "" : "s"}</p>
                            </div>
                            <p className="font-semibold text-slate-950">{formatCurrency(group.total)}</p>
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...group.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatDate(item.dueDate)}</TableCell>
                          <TableCell>
                            <p className="font-medium text-slate-950">{item.supplier}</p>
                            {item.companyName ? <p className="text-xs text-slate-500">{item.companyName}</p> : null}
                          </TableCell>
                          <TableCell>
                            <p>{item.description}</p>
                            <p className="text-xs text-slate-500">Parcela {item.installmentNumber}</p>
                          </TableCell>
                          <TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass[item.status]}`}>{statusLabel[item.status]}</span></TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                          <TableCell className="text-sm text-slate-500">{item.notes || "-"}</TableCell>
                        </TableRow>
                      )),
                    ])}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </ClinicLayout>
  );
}
