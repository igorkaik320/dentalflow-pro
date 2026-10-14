import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function usePagination<T>(items: T[], initialPageSize = 30, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(items.length, startIndex + pageSize);
  const pageItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);
  return { pageItems, page, setPage, pageSize, setPageSize, totalPages, startIndex, endIndex, totalItems: items.length };
}

type Props = {
  totalItems: number;
  startIndex: number;
  endIndex: number;
  page: number;
  totalPages: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
};

export function TablePagination({ totalItems, startIndex, endIndex, page, totalPages, pageSize, setPage, setPageSize }: Props) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>{totalItems > 0 ? `Mostrando ${startIndex + 1}-${endIndex} de ${totalItems}` : "Nenhum item para mostrar"}</div>
      <div className="flex flex-wrap items-center gap-2">
        <span>Itens por página</span>
        <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
          <SelectTrigger className="h-8 w-[82px] bg-card text-xs shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="60">60</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Página anterior" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[74px] text-center">{page} de {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Próxima página" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
