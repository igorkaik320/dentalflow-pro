import { useEffect, useId, useMemo, useState } from "react";
import { Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export type EntitySearchOption = {
  id: string;
  label: string;
  description?: string;
  search?: string;
  code?: string;
  legalName?: string;
  document?: string;
};

type EntitySearchInputProps = {
  label: string;
  value: string;
  options: EntitySearchOption[];
  placeholder?: string;
  allowCustom?: boolean;
  advanced?: boolean;
  modalTitle?: string;
  onQueryChange?: (value: string) => void;
  onSelect: (option: EntitySearchOption) => void;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function EntitySearchInput({
  label,
  value,
  options,
  placeholder,
  advanced = false,
  modalTitle,
  onQueryChange,
  onSelect,
}: EntitySearchInputProps) {
  const inputId = useId();
  const [codeQuery, setCodeQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mCode, setMCode] = useState("");
  const [mName, setMName] = useState("");
  const [mLegal, setMLegal] = useState("");
  const [mDoc, setMDoc] = useState("");
  const [results, setResults] = useState<EntitySearchOption[]>([]);

  useEffect(() => {
    if (codeQuery === null) setQuery(value || "");
  }, [value, codeQuery]);
  const displayedCode = codeQuery ?? options.find(o => o.label === value)?.code ?? "";
  const showCode = advanced && (options.some(o => o.code) || /empresa|cliente|credor/i.test(label));
  const resolveCode = () => {
    const match = options.find(o => o.code === displayedCode.trim());
    if (match) pick(match);
  };

  const filtered = useMemo(() => {
    const term = normalize(query);
    const digits = digitsOnly(query);
    if (!term && !digits) return options;
    return options.filter((option) => {
      const haystack = normalize(`${option.code || ""} ${option.label} ${option.legalName || ""} ${option.description || ""} ${option.search || ""}`);
      const numeric = digitsOnly(`${option.document || ""} ${option.description || ""} ${option.search || ""}`);
      return haystack.includes(term) || (!!digits && digits.length >= 3 && numeric.includes(digits));
    });
  }, [options, query]);

  const runSearch = () => {
    const c = normalize(mCode), n = normalize(mName), r = normalize(mLegal), d = digitsOnly(mDoc);
    setResults(options.filter((o) =>
      (!c || normalize(o.code || "").includes(c)) &&
      (!n || normalize(o.label).includes(n)) &&
      (!r || normalize(o.legalName || "").includes(r)) &&
      (!d || digitsOnly(o.document || "").includes(d)),
    ));
  };

  const openModal = () => {
    setMCode(displayedCode); setMName(query); setMLegal(""); setMDoc("");
    setOpen(false);
    setDialogOpen(true);
    const n = normalize(query);
    setResults(n ? options.filter((o) => normalize(o.label).includes(n)) : options);
  };

  const pick = (option: EntitySearchOption) => {
    setQuery(option.label);
    setCodeQuery(null);
    setOpen(false);
    setDialogOpen(false);
    onSelect(option);
  };

  return (
    <div className="space-y-1.5 min-w-0">
      {!showCode && <Label htmlFor={inputId}>{label}</Label>}
      <div className="flex min-w-0 items-end gap-2">
        {showCode && <div className="w-20 shrink-0 space-y-1.5 sm:w-24"><Label htmlFor={`${inputId}-inline-code`}>Cód.</Label><Input id={`${inputId}-inline-code`} aria-label={`Código de ${label}`} placeholder="Cód" inputMode="numeric" value={displayedCode} onChange={e => {
          setCodeQuery(e.target.value);
          setQuery("");
          onQueryChange?.("");
          setOpen(false);
        }} onBlur={resolveCode} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); resolveCode(); } }} /></div>}
        <div className="relative min-w-0 flex-1">
          {showCode && <Label htmlFor={inputId} className="mb-1.5 block">Nome {label.toLowerCase()}</Label>}
          {!advanced && <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
          <Input id={inputId} className={advanced ? "" : "pl-9"} value={query} placeholder={placeholder}
            onChange={event => { const nextValue = event.target.value; setQuery(nextValue); setCodeQuery(null); onQueryChange?.(nextValue); setOpen(true); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
            onKeyDown={e => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && open && filtered.length === 1) { e.preventDefault(); pick(filtered[0]); } }} />
          {open && filtered.length > 0 && <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
            {filtered.slice(0, 100).map(option => <Button key={option.id} type="button" variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-2 text-left" onMouseDown={e => e.preventDefault()} onClick={() => pick(option)}>
              <div className="min-w-0 whitespace-normal"><div className="font-medium text-foreground">{option.code ? `${option.code} - ` : ""}{option.label}</div>{option.description && <div className="text-xs text-muted-foreground">{option.description}</div>}</div>
            </Button>)}
          </div>}
        </div>
        {advanced && <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label={`Consultar ${label}`} title={`Consultar ${label}`} onClick={openModal}><Search className="h-4 w-4" /></Button>}
      </div>

      {advanced ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[90vw]">
            <DialogHeader><DialogTitle>{modalTitle || `Consultar ${label}`}</DialogTitle></DialogHeader>
            <form
              className="entity-search-filters grid grid-cols-1 gap-3 rounded-lg p-4 sm:grid-cols-2 lg:grid-cols-[80px_1fr_1fr_190px]"
              onSubmit={(e) => { e.preventDefault(); runSearch(); }}
            >
              <div><Label htmlFor={`${inputId}-code`}>Código</Label><Input id={`${inputId}-code`} value={mCode} onChange={(e) => setMCode(e.target.value)} /></div>
              <div><Label htmlFor={`${inputId}-name`}>Nome</Label><Input id={`${inputId}-name`} value={mName} onChange={(e) => setMName(e.target.value)} /></div>
              <div><Label htmlFor={`${inputId}-legal`}>Razão social</Label><Input id={`${inputId}-legal`} value={mLegal} onChange={(e) => setMLegal(e.target.value)} /></div>
              <div><Label htmlFor={`${inputId}-doc`}>CPF/CNPJ</Label><Input id={`${inputId}-doc`} value={mDoc} onChange={(e) => setMDoc(e.target.value)} /></div>
              <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4"><Button type="button" variant="outline" onClick={() => { setMCode(""); setMName(""); setMLegal(""); setMDoc(""); setResults(options); }}><X className="h-4 w-4" />Limpar</Button><Button type="submit"><Search className="h-4 w-4" />Consultar</Button></div>
            </form>
            <div className="max-h-[50vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Razão social</th><th className="p-2 text-left">CPF/CNPJ</th><th className="w-12"><span className="sr-only">Selecionar</span></th></tr>
                </thead>
                <tbody>
                  {results.map((o) => (
                    <tr key={o.id} className="cursor-pointer border-t border-border/50 hover:bg-accent" onDoubleClick={() => pick(o)} onClick={() => pick(o)}>
                      <td className="p-2">{o.code || "-"}</td>
                      <td className="p-2 font-medium">{o.label}</td>
                      <td className="p-2 text-muted-foreground">{o.legalName || "-"}</td>
                      <td className="p-2 text-muted-foreground">{o.document || "-"}</td><td className="p-2"><Button type="button" variant="ghost" size="icon" aria-label={`Selecionar ${o.label}`} onClick={e => { e.stopPropagation(); pick(o); }}><Check className="h-4 w-4 text-primary" /></Button></td>
                    </tr>
                  ))}
                  {results.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <DialogFooter className="items-center gap-2"><p className="mr-auto text-xs text-muted-foreground">{results.length} registro(s)</p><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
