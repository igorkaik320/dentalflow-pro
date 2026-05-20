import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EntitySearchOption = {
  id: string;
  label: string;
  description?: string;
  search?: string;
};

type EntitySearchInputProps = {
  label: string;
  value: string;
  options: EntitySearchOption[];
  placeholder?: string;
  allowCustom?: boolean;
  onQueryChange?: (value: string) => void;
  onSelect: (option: EntitySearchOption) => void;
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function EntitySearchInput({
  label,
  value,
  options,
  placeholder,
  allowCustom = false,
  onQueryChange,
  onSelect,
}: EntitySearchInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    const digits = digitsOnly(query);
    if (!term && !digits) return options;

    return options.filter((option) => {
      const haystack = normalize(`${option.label} ${option.description || ""} ${option.search || ""}`);
      const numeric = digitsOnly(`${option.description || ""} ${option.search || ""}`);
      return haystack.includes(term) || (!!digits && numeric.includes(digits));
    });
  }, [options, query]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onQueryChange?.(nextValue);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
        />
        {open && filtered.length > 0 ? (
          <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
            {filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => {
                  setQuery(option.label);
                  setOpen(false);
                  onSelect(option);
                }}
              >
                <div className="font-medium text-foreground">{option.label}</div>
                {option.description ? <div className="text-xs text-muted-foreground">{option.description}</div> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
