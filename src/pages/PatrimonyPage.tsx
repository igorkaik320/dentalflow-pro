import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Download,
  Eye,
  FilterX,
  Grid3X3,
  ImagePlus,
  List,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, parseCurrencyInput } from "@/lib/utils";

type PatrimonyStatus = "Otimo" | "Bom" | "Regular" | "Danificado" | "Descartado";
type ViewMode = "grid" | "list";
type SortKey = "name" | "environment" | "quantity" | "value" | "color" | "supplier" | "status" | "created_at";

type PatrimonyItem = {
  id: string;
  clinic_id: string;
  environment: string;
  name: string;
  quantity: number;
  value: number;
  color: string | null;
  supplier: string | null;
  model: string | null;
  photo_url: string | null;
  description: string | null;
  status: PatrimonyStatus;
  created_at: string;
  updated_at: string;
};

type PatrimonyForm = {
  environment: string;
  name: string;
  quantity: string;
  value: string;
  color: string;
  supplier: string;
  model: string;
  photo_url: string;
  description: string;
  status: PatrimonyStatus;
};

const environments = [
  "Administração",
  "Copa",
  "Lavanderia",
  "Área Interna",
  "Banheiro Interno",
  "Área Externa",
  "Biomédicas",
  "Recepção",
  "Banheiro Cliente",
  "Hyperslim",
  "Fachada",
  "Garagem",
  "Área Comum 1º Pav",
  "Avaliação 1",
  "Avaliação 2",
  "Atendimento 2",
  "Atendimento 3",
  "Atendimento 4",
  "Atendimento 5",
  "Atendimento 6",
  "Atendimento 7",
  "Atendimento 8",
  "Atendimento 9",
  "Atendimento 10",
  "Atendimento 11",
  "Atendimento 12",
  "Estoque",
];

const statusOptions: Array<{ value: PatrimonyStatus; label: string; className: string; selected: string }> = [
  { value: "Otimo", label: "Ótimo", className: "bg-emerald-50 text-emerald-700 border-emerald-200", selected: "border-emerald-500 bg-emerald-100 text-emerald-800" },
  { value: "Bom", label: "Bom", className: "bg-blue-50 text-blue-700 border-blue-200", selected: "border-blue-500 bg-blue-100 text-blue-800" },
  { value: "Regular", label: "Regular", className: "bg-amber-50 text-amber-700 border-amber-200", selected: "border-amber-500 bg-amber-100 text-amber-800" },
  { value: "Danificado", label: "Danificado", className: "bg-orange-50 text-orange-700 border-orange-200", selected: "border-orange-500 bg-orange-100 text-orange-800" },
  { value: "Descartado", label: "Descartado", className: "bg-red-50 text-red-700 border-red-200", selected: "border-red-500 bg-red-100 text-red-800" },
];

const blankForm: PatrimonyForm = {
  environment: environments[0],
  name: "",
  quantity: "1",
  value: "",
  color: "",
  supplier: "",
  model: "",
  photo_url: "",
  description: "",
  status: "Bom",
};

function statusLabel(status: PatrimonyStatus) {
  return statusOptions.find((option) => option.value === status)?.label || status;
}

function statusClass(status: PatrimonyStatus) {
  return statusOptions.find((option) => option.value === status)?.className || "bg-muted text-muted-foreground";
}

function formatDate(dateText?: string | null) {
  if (!dateText) return "-";
  return new Date(dateText).toLocaleDateString("pt-BR");
}

function sanitizeSearch(value: string) {
  return value.replace(/[%_,]/g, " ").trim();
}

function toForm(item: PatrimonyItem): PatrimonyForm {
  return {
    environment: item.environment || environments[0],
    name: item.name || "",
    quantity: String(item.quantity || 1),
    value: item.value ? formatCurrency(Number(item.value)) : "",
    color: item.color || "",
    supplier: item.supplier || "",
    model: item.model || "",
    photo_url: item.photo_url || "",
    description: item.description || "",
    status: item.status || "Bom",
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("image_read_failed"));
    reader.readAsDataURL(file);
  });
}

async function uploadPhoto(clinicId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${clinicId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("patrimony-photos").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) {
    console.warn("Patrimony photo upload failed, saving inline image.", error);
    return fileToDataUrl(file);
  }
  const { data } = supabase.storage.from("patrimony-photos").getPublicUrl(path);
  return data.publicUrl;
}

export default function PatrimonyPage() {
  const { clinic, can } = useClinic();
  const canCreate = can("patrimony", "create");
  const canUpdate = can("patrimony", "update");
  const canDelete = can("patrimony", "delete");
  const [items, setItems] = useState<PatrimonyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [totalCount, setTotalCount] = useState(0);
  const [editingItem, setEditingItem] = useState<PatrimonyItem | null>(null);
  const [detailItem, setDetailItem] = useState<PatrimonyItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PatrimonyForm>(blankForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [reportEnvironment, setReportEnvironment] = useState(environments[0]);
  const [reportItems, setReportItems] = useState<PatrimonyItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clinic.id) {
      setLoading(false);
      return;
    }
    void loadItems();
  }, [clinic.id, currentPage, pageSize, search, environmentFilter, statusFilter, colorFilter, supplierFilter, sortKey, sortDirection]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, environmentFilter, statusFilter, colorFilter, supplierFilter, pageSize]);

  useEffect(() => {
    if (!clinic.id) return;
    void loadReportItems();
  }, [clinic.id, reportEnvironment]);

  const loadItems = async () => {
    if (!clinic.id) return;
    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = db
      .from("patrimonies")
      .select("*", { count: "exact" })
      .eq("clinic_id", clinic.id);

    const cleanSearch = sanitizeSearch(search);
    if (cleanSearch) {
      const pattern = `%${cleanSearch}%`;
      query = query.or(`name.ilike.${pattern},environment.ilike.${pattern},color.ilike.${pattern},supplier.ilike.${pattern},model.ilike.${pattern},description.ilike.${pattern}`);
    }
    if (environmentFilter !== "all") query = query.eq("environment", environmentFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (colorFilter.trim()) query = query.ilike("color", `%${sanitizeSearch(colorFilter)}%`);
    if (supplierFilter.trim()) query = query.ilike("supplier", `%${sanitizeSearch(supplierFilter)}%`);

    const { data, error, count } = await query
      .order(sortKey, { ascending: sortDirection === "asc" })
      .range(from, to);
    setLoading(false);
    if (error) return toast.error("Não foi possível carregar o patrimônio.");
    setItems(data || []);
    setTotalCount(count || 0);
  };

  const loadReportItems = async () => {
    if (!clinic.id) return;
    const { data, error } = await db
      .from("patrimonies")
      .select("*")
      .eq("clinic_id", clinic.id)
      .eq("environment", reportEnvironment)
      .order("name", { ascending: true });
    if (error) return toast.error("NÃ£o foi possÃ­vel carregar o relatÃ³rio.");
    setReportItems(data || []);
  };

  const visibleItems = items;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstVisible = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisible = Math.min(currentPage * pageSize, totalCount);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    const totalQuantity = visibleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalValue = visibleItems.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const damaged = visibleItems.filter((item) => item.status === "Danificado").length;
    const discarded = visibleItems.filter((item) => item.status === "Descartado").length;
    return { totalQuantity, totalValue, damaged, discarded };
  }, [visibleItems]);

  const reportTotal = useMemo(() => reportItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [reportItems]);
  const reportValueTotal = useMemo(() => reportItems.reduce((sum, item) => sum + Number(item.value || 0), 0), [reportItems]);

  const openNewForm = () => {
    if (!canCreate) return toast.error("Voce nao tem permissao para criar patrimonio.");
    setEditingItem(null);
    setForm(blankForm);
    setPhotoFile(null);
    setPhotoPreview("");
    setFormOpen(true);
  };

  const openEditForm = (item: PatrimonyItem) => {
    if (!canUpdate) return toast.error("Voce nao tem permissao para editar patrimonio.");
    setEditingItem(item);
    setForm(toForm(item));
    setPhotoFile(null);
    setPhotoPreview(item.photo_url || "");
    setFormOpen(true);
  };

  const handlePhotoChange = async (file?: File) => {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(await fileToDataUrl(file));
  };

  const saveItem = async () => {
    if (!clinic.id) return;
    if (editingItem && !canUpdate) return toast.error("Voce nao tem permissao para editar patrimonio.");
    if (!editingItem && !canCreate) return toast.error("Voce nao tem permissao para criar patrimonio.");
    if (!form.name.trim()) return toast.error("Informe o nome do item.");
    if (!form.environment) return toast.error("Informe o ambiente.");
    const quantity = Math.max(0, Number.parseInt(form.quantity, 10) || 0);
    const value = parseCurrencyInput(form.value);
    setSaving(true);
    try {
      const photoUrl = photoFile ? await uploadPhoto(clinic.id, photoFile) : form.photo_url || null;
      const payload = {
        clinic_id: clinic.id,
        environment: form.environment,
        name: form.name.trim(),
        quantity,
        value,
        color: form.color.trim() || null,
        supplier: form.supplier.trim() || null,
        model: form.model.trim() || null,
        photo_url: photoUrl,
        description: form.description.trim() || null,
        status: form.status,
      };
      const query = editingItem
        ? db.from("patrimonies").update(payload).eq("id", editingItem.id).eq("clinic_id", clinic.id)
        : db.from("patrimonies").insert(payload);
      const { error } = await query;
      if (error) throw error;
      toast.success(editingItem ? "Item atualizado." : "Item cadastrado.");
      setFormOpen(false);
      await loadItems();
      await loadReportItems();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar o item.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: PatrimonyItem) => {
    if (!clinic.id) return;
    if (!canDelete) return toast.error("Voce nao tem permissao para excluir patrimonio.");
    if (!window.confirm(`Excluir ${item.name}?`)) return;
    const { error } = await db.from("patrimonies").delete().eq("id", item.id).eq("clinic_id", clinic.id);
    if (error) return toast.error("Não foi possível excluir o item.");
    toast.success("Item excluído.");
    await loadItems();
    await loadReportItems();
  };

  const clearFilters = () => {
    setSearch("");
    setEnvironmentFilter("all");
    setStatusFilter("all");
    setColorFilter("");
    setSupplierFilter("");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const printReport = () => {
    window.print();
  };

  const exportPdf = async () => {
    if (exporting) return;
    if (!reportRef.current || reportItems.length === 0) return toast.error("Não há itens para exportar.");
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
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
      pdf.save(`patrimonio_${reportEnvironment.replace(/[^\w-]+/g, "_").toLowerCase()}.pdf`);
      toast.success("PDF gerado.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível gerar o PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <ClinicLayout title="Patrimônio" subtitle="Controle de móveis, equipamentos e objetos da clínica">
      <div className="space-y-5 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Itens cadastrados</p>
            <p className="text-2xl font-bold mt-1">{totalCount}</p>
          </Card>
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Unidades nesta página</p>
            <p className="text-2xl font-bold mt-1">{summary.totalQuantity}</p>
          </Card>
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Valor nesta página</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalValue)}</p>
          </Card>
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Danificados na página</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{summary.damaged}</p>
          </Card>
          <Card className="stat-card">
            <p className="text-xs text-muted-foreground">Descartados na página</p>
            <p className="text-2xl font-bold text-destructive mt-1">{summary.discarded}</p>
          </Card>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_180px_160px_160px_180px_auto] gap-3 items-end">
            <div>
              <Label>Buscar item</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, fornecedor, modelo ou descrição" className="pl-9" />
              </div>
            </div>
            <div>
              <Label>Ambiente</Label>
              <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {environments.map((environment) => <SelectItem key={environment} value={environment}>{environment}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input value={colorFilter} onChange={(event) => setColorFilter(event.target.value)} placeholder="Todas" />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} placeholder="Todos" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={clearFilters} title="Limpar filtros"><FilterX className="h-4 w-4" /></Button>
              <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")} title="Grade"><Grid3X3 className="h-4 w-4" /></Button>
              <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")} title="Lista"><List className="h-4 w-4" /></Button>
              <Button onClick={openNewForm} disabled={!canCreate}><Plus className="h-4 w-4 mr-2" />Novo</Button>
            </div>
          </div>
        </Card>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {visibleItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                  {item.photo_url ? <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" /> : <Package className="h-10 w-10 text-muted-foreground" />}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{item.environment}</p>
                    </div>
                    <Badge className={statusClass(item.status)}>{statusLabel(item.status)}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Qtd.</span><p className="font-medium">{item.quantity}</p></div>
                    <div><span className="text-muted-foreground">Valor</span><p className="font-medium truncate">{formatCurrency(Number(item.value || 0))}</p></div>
                    <div><span className="text-muted-foreground">Cor</span><p className="font-medium truncate">{item.color || "-"}</p></div>
                    <div><span className="text-muted-foreground">Fornecedor</span><p className="font-medium truncate">{item.supplier || "-"}</p></div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => setDetailItem(item)} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                    {canUpdate ? <Button variant="outline" size="icon" onClick={() => openEditForm(item)} title="Editar"><Pencil className="h-4 w-4" /></Button> : null}
                    {canDelete ? <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => void deleteItem(item)} title="Excluir"><Trash2 className="h-4 w-4" /></Button> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && visibleItems.length === 0 ? <div className="col-span-full text-center text-sm text-muted-foreground py-10">Nenhum item encontrado.</div> : null}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foto</TableHead>
                    {[
                      ["name", "Nome"],
                      ["environment", "Ambiente"],
                      ["quantity", "Qtd."],
                      ["value", "Valor"],
                      ["color", "Cor"],
                      ["supplier", "Fornecedor"],
                      ["status", "Status"],
                    ].map(([key, label]) => (
                      <TableHead key={key}>
                        <button className="inline-flex items-center gap-1" onClick={() => toggleSort(key as SortKey)}>
                          {label}<ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="h-12 w-14 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          {item.photo_url ? <img src={item.photo_url} alt={item.name} className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.environment}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(item.value || 0))}</TableCell>
                      <TableCell>{item.color || "-"}</TableCell>
                      <TableCell>{item.supplier || "-"}</TableCell>
                      <TableCell><Badge className={statusClass(item.status)}>{statusLabel(item.status)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => setDetailItem(item)}><Eye className="h-4 w-4" /></Button>
                          {canUpdate ? <Button variant="outline" size="icon" onClick={() => openEditForm(item)}><Pencil className="h-4 w-4" /></Button> : null}
                          {canDelete ? <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => void deleteItem(item)}><Trash2 className="h-4 w-4" /></Button> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!loading && visibleItems.length === 0 ? <div className="text-center text-sm text-muted-foreground py-10">Nenhum item encontrado.</div> : null}
            </CardContent>
          </Card>
        )}

        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {firstVisible} a {lastVisible} de {totalCount} itens
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 por página</SelectItem>
                  <SelectItem value="24">24 por página</SelectItem>
                  <SelectItem value="48">48 por página</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={currentPage <= 1 || loading} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                  Anterior
                </Button>
                <span className="min-w-24 text-center text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Button variant="outline" disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Relatório por ambiente</CardTitle>
              <p className="text-sm text-muted-foreground">Selecione um ambiente para imprimir ou exportar.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={reportEnvironment} onValueChange={setReportEnvironment}>
                <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {environments.map((environment) => <SelectItem key={environment} value={environment}>{environment}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={printReport}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
              <Button onClick={exportPdf} disabled={exporting || reportItems.length === 0}><Download className="h-4 w-4 mr-2" />{exporting ? "Gerando..." : "PDF"}</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={reportRef} className="bg-white text-slate-950 rounded-md border p-4 print:border-0">
              <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between border-b pb-3 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Patrimônio</p>
                  <h2 className="text-xl font-bold">{reportEnvironment}</h2>
                  <p className="text-sm text-slate-500">{clinic.name}</p>
                </div>
                <div className="text-sm md:text-right text-slate-600">
                  <p>{reportItems.length} item{reportItems.length === 1 ? "" : "s"}</p>
                  <p>Quantidade total: {reportTotal}</p>
                  <p>Valor total: {formatCurrency(reportValueTotal)}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(item.value || 0))}</TableCell>
                      <TableCell>{item.color || "-"}</TableCell>
                      <TableCell>{item.supplier || "-"}</TableCell>
                      <TableCell>{item.model || "-"}</TableCell>
                      <TableCell>{statusLabel(item.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {reportItems.length === 0 ? <div className="py-8 text-center text-sm text-slate-500">Nenhum item neste ambiente.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar item" : "Cadastrar item"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
            <div>
              <Label>Foto</Label>
              <label className="mt-2 flex aspect-square cursor-pointer items-center justify-center rounded-lg border bg-muted overflow-hidden">
                {photoPreview ? <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" /> : <div className="text-center text-muted-foreground"><ImagePlus className="h-8 w-8 mx-auto mb-2" /><span className="text-sm">Enviar foto</span></div>}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handlePhotoChange(event.target.files?.[0])} />
              </label>
              {photoPreview ? <Button variant="ghost" className="mt-2 w-full" onClick={() => { setPhotoFile(null); setPhotoPreview(""); setForm((current) => ({ ...current, photo_url: "" })); }}><X className="h-4 w-4 mr-2" />Remover foto</Button> : null}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="CADEIRA GIRATÓRIA" />
                </div>
                <div>
                  <Label>Ambiente</Label>
                  <Select value={form.environment} onValueChange={(value) => setForm({ ...form, environment: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {environments.map((environment) => <SelectItem key={environment} value={environment}>{environment}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input
                    value={form.value}
                    onChange={(event) => setForm({ ...form, value: formatCurrency(parseCurrencyInput(event.target.value)) })}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} placeholder="PRETO" />
                </div>
                <div>
                  <Label>Fornecedor / Marca</Label>
                  <Input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="DELL" />
                </div>
                <div>
                  <Label>Modelo</Label>
                  <Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} placeholder="INTEL CORE i3" />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm({ ...form, status: option.value })}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition ${form.status === option.value ? option.selected : option.className}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Descrição / observações</Label>
                <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="Observações livres sobre o item" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button onClick={saveItem} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          {detailItem ? (
            <>
              <DialogHeader>
                <DialogTitle>{detailItem.name}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
                <div className="aspect-square rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                  {detailItem.photo_url ? <img src={detailItem.photo_url} alt={detailItem.name} className="h-full w-full object-cover" /> : <Package className="h-12 w-12 text-muted-foreground" />}
                </div>
                <div className="space-y-5">
                  <section>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Ambiente</p>
                        <p className="font-semibold">{detailItem.environment}</p>
                      </div>
                      <Badge className={statusClass(detailItem.status)}>{statusLabel(detailItem.status)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-medium">{detailItem.quantity}</p></div>
                      <div><p className="text-xs text-muted-foreground">Valor</p><p className="font-medium">{formatCurrency(Number(detailItem.value || 0))}</p></div>
                      <div><p className="text-xs text-muted-foreground">Cor</p><p className="font-medium">{detailItem.color || "-"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-medium">{detailItem.supplier || "-"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Modelo</p><p className="font-medium">{detailItem.model || "-"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Cadastro</p><p className="font-medium">{formatDate(detailItem.created_at)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Atualização</p><p className="font-medium">{formatDate(detailItem.updated_at)}</p></div>
                    </div>
                  </section>
                  <section>
                    <p className="text-xs text-muted-foreground">Descrição</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{detailItem.description || "Sem observações."}</p>
                  </section>
                  <section className="rounded-md border p-3">
                    <p className="font-medium">Histórico</p>
                    <p className="text-sm text-muted-foreground mt-1">Criado em {formatDate(detailItem.created_at)}. Última alteração em {formatDate(detailItem.updated_at)}.</p>
                  </section>
                  <div className="flex justify-end gap-2">
                    {canUpdate ? <Button variant="outline" onClick={() => openEditForm(detailItem)}><Pencil className="h-4 w-4 mr-2" />Editar</Button> : null}
                    {canDelete ? <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void deleteItem(detailItem)}><Trash2 className="h-4 w-4 mr-2" />Excluir</Button> : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </ClinicLayout>
  );
}
