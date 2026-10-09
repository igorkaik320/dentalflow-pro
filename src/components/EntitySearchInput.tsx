import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mCode, setMCode] = useState("");
  const [mName, setMName] = useState("");
  const [mLegal, setMLegal] = useState("");
  const [mDoc, setMDoc] = useState("");
  const [results, setResults] = useState<EntitySearchOption[]>([]);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

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
    setMCode(""); setMName(query); setMLegal(""); setMDoc("");
    setOpen(false);
    setDialogOpen(true);
    const n = normalize(query);
    setResults(n ? options.filter((o) => normalize(o.label).includes(n)) : options);
  };

  const pick = (option: EntitySearchOption) => {
    setQuery(option.label);
    setOpen(false);
    setDialogOpen(false);
    onSelect(option);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        {advanced ? (
          <button type="button" aria-label={`Consultar ${label}`} onClick={openModal} className="absolute left-2 inset-y-0 flex items-center text-muted-foreground hover:text-primary">
            <Search className="h-4 w-4" />
          </button>
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          className="pl-9"
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onQueryChange?.(nextValue);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {open && filtered.length > 0 ? (
          <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
            {filtered.slice(0, 100).map((option) => (
              <button key={option.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={() => pick(option)}>
                <div className="font-medium text-foreground">{option.code ? `${option.code} - ` : ""}{option.label}</div>
                {option.description ? <div className="text-xs text-muted-foreground">{option.description}</div> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {advanced ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>{modalTitle || `Consultar ${label}`}</DialogTitle></DialogHeader>
            <form
              className="grid grid-cols-1 gap-3 md:grid-cols-[100px_1fr_1fr_170px_auto] md:items-end"
              onSubmit={(e) => { e.preventDefault(); runSearch(); }}
            >
              <div><Label>Código</Label><Input value={mCode} onChange={(e) => setMCode(e.target.value)} /></div>
              <div><Label>Nome</Label><Input value={mName} onChange={(e) => setMName(e.target.value)} /></div>
              <div><Label>Razão social</Label><Input value={mLegal} onChange={(e) => setMLegal(e.target.value)} /></div>
              <div><Label>CPF/CNPJ</Label><Input value={mDoc} onChange={(e) => setMDoc(e.target.value)} /></div>
              <Button type="submit"><Search className="mr-1 h-4 w-4" />Consultar</Button>
            </form>
            <div className="max-h-[50vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr><th className="p-2 text-left">Código</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Razão social</th><th className="p-2 text-left">CPF/CNPJ</th></tr>
                </thead>
                <tbody>
                  {results.map((o) => (
                    <tr key={o.id} className="cursor-pointer border-t border-border/50 hover:bg-accent" onDoubleClick={() => pick(o)} onClick={() => pick(o)}>
                      <td className="p-2">{o.code || "-"}</td>
                      <td className="p-2 font-medium">{o.label}</td>
                      <td className="p-2 text-muted-foreground">{o.legalName || "-"}</td>
                      <td className="p-2 text-muted-foreground">{o.document || "-"}</td>
                    </tr>
                  ))}
                  {results.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{results.length} registro(s). Clique em uma linha para selecionar.</p>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
