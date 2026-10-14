import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EntitySearchInput, type EntitySearchOption } from "@/components/EntitySearchInput";
import { cn } from "@/lib/utils";

export type FinanceFilters = {
  companyId: string;
  companyName: string;
  entityId: string;
  entityName: string;
  category: string;
  statuses: string[];
  start: string;
  end: string;
};

export const emptyFinanceFilters: FinanceFilters = { companyId: "", companyName: "", entityId: "", entityName: "", category: "", statuses: [], start: "", end: "" };

export const financeStatusOptions = [
  { value: "open", label: "Aberto" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Atrasado" },
];

type Props = {
  value: FinanceFilters;
  onChange: (next: FinanceFilters) => void;
  onApply: () => void;
  onClear: () => void;
  companyOptions: EntitySearchOption[];
  entityLabel: string;
  entityOptions: EntitySearchOption[];
  categoryOptions: EntitySearchOption[];
  description: string;
};

export function FinanceFilterPanel({ value, onChange, onApply, onClear, companyOptions, entityLabel, entityOptions, categoryOptions, description }: Props) {
  const [open, setOpen] = useState(true);
  const [statusQuery, setStatusQuery] = useState("");
  const set = (changes: Partial<FinanceFilters>) => onChange({ ...value, ...changes });
  const statusLabel = value.statuses.length === 0
    ? "Todos"
    : financeStatusOptions.filter(s => value.statuses.includes(s.value)).map(s => s.label).join(", ");
  const filteredStatus = useMemo(() => financeStatusOptions.filter(s => s.label.toLowerCase().includes(statusQuery.toLowerCase())), [statusQuery]);
  const toggleStatus = (status: string) => set({ statuses: value.statuses.includes(status) ? value.statuses.filter(s => s !== status) : [...value.statuses, status] });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="mb-4 w-full justify-start">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
          {open ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <form className="saas-panel mb-6 p-6" onSubmit={(e) => { e.preventDefault(); onApply(); }}>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-foreground">Filtros de Busca</h3>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-2 lg:col-span-3">
              <EntitySearchInput advanced label="Empresa" value={value.companyName} options={companyOptions} placeholder="Nome da empresa..."
                onQueryChange={(text) => set({ companyId: "", companyName: text })}
                onSelect={(o) => set({ companyId: o.id, companyName: o.label })} />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <EntitySearchInput advanced label={entityLabel} value={value.entityName} options={entityOptions} placeholder={`Nome do ${entityLabel.toLowerCase()}...`}
                onQueryChange={(text) => set({ entityId: "", entityName: text })}
                onSelect={(o) => set({ entityId: o.id, entityName: o.label })} />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <EntitySearchInput advanced label="Categoria" value={value.category} options={categoryOptions} placeholder="Nome da categoria..."
                onQueryChange={(text) => set({ category: text })}
                onSelect={(o) => set({ category: o.label })} />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-10 w-full justify-start bg-card px-3 text-left text-sm font-normal shadow-none">
                    <span className="truncate">{statusLabel}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-2">
                  <Input className="mb-2 h-8 text-sm" placeholder="Digite para pesquisar" value={statusQuery} onChange={(e) => setStatusQuery(e.target.value)} />
                  <div className="max-h-52 overflow-auto">
                    {filteredStatus.length === 0 ? <div className="px-2 py-2 text-sm text-muted-foreground">Nenhum status encontrado</div> : filteredStatus.map(status => (
                      <button key={status.value} type="button" className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent" onClick={() => toggleStatus(status.value)}>
                        <span className={cn("h-4 w-4 flex-shrink-0 rounded border border-input", value.statuses.includes(status.value) && "border-primary bg-primary")} />
                        <span className="min-w-0 truncate">{status.label}</span>
                      </button>
                    ))}
                  </div>
                  {value.statuses.length > 0 && <Button type="button" variant="ghost" size="sm" className="mt-2 h-8 w-full" onClick={() => set({ statuses: [] })}>Limpar status</Button>}
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5"><Label>Data Início</Label><Input type="date" value={value.start} onChange={(e) => set({ start: e.target.value })} /></div>
              <div className="flex-1 space-y-1.5"><Label>Data Fim</Label><Input type="date" value={value.end} onChange={(e) => set({ end: e.target.value })} /></div>
            </div>

            <div className="flex items-end gap-2">
              <Button type="button" variant="outline" onClick={onClear} className="flex-1"><RotateCcw className="mr-2 h-4 w-4" />Limpar</Button>
              <Button type="submit" className="flex-1"><Search className="mr-2 h-4 w-4" />Consultar</Button>
            </div>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
