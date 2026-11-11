import { describe, expect, it } from "vitest";
import { DEFAULT_FINANCE_SORT, sortRows } from "@/lib/financeOrder";

type Row = { name: string; createdAt?: string; dueDate: string; amount: number };

const rows: Row[] = [
  { name: "antiga", createdAt: "2026-01-05T10:00:00Z", dueDate: "2026-03-01", amount: 100 },
  { name: "nova", createdAt: "2026-11-06T16:42:03Z", dueDate: "2026-11-20", amount: 5500 },
  { name: "sem-data", dueDate: "2026-12-01", amount: 200 },
];

const names = (sorted: Row[]) => sorted.map(r => r.name);

describe("ordem dos lançamentos financeiros", () => {
  it("começa ordenado pelo lançamento mais recente", () => {
    expect(DEFAULT_FINANCE_SORT).toEqual({ key: "created", dir: "desc" });
  });

  it("traz o lançamento novo primeiro", () => {
    const sorted = sortRows(rows, DEFAULT_FINANCE_SORT, (r, k) => (k === "created" ? r.createdAt || "" : ""));
    expect(names(sorted)).toEqual(["nova", "antiga", "sem-data"]);
  });

  it("mantém o usuário no controle ao ordenar por vencimento", () => {
    const sorted = sortRows(rows, { key: "dueDate", dir: "asc" }, (r, k) => (k === "dueDate" ? r.dueDate : ""));
    expect(names(sorted)).toEqual(["antiga", "nova", "sem-data"]);
  });

  it("ordena valores numericamente", () => {
    const sorted = sortRows(rows, { key: "amount", dir: "desc" }, (r, k) => (k === "amount" ? r.amount : 0));
    expect(names(sorted)).toEqual(["nova", "sem-data", "antiga"]);
  });
});
