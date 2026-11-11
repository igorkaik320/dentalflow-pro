export type SortState = { key: string; dir: "asc" | "desc" };

/** New registrations must always appear first in the financial listings. */
export const DEFAULT_FINANCE_SORT: SortState = { key: "created", dir: "desc" };

export function sortRows<T>(rows: T[], sort: SortState, get: (row: T, key: string) => string | number) {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a, sort.key), vb = get(b, sort.key);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va).localeCompare(String(vb), "pt-BR") * dir;
  });
}
