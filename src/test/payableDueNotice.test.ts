import { describe, it, expect } from "vitest";
import { clinicToday, duePeriod, isNoticeHidden, noticeStorageKey, summarizeDueInstallments } from "@/lib/payableDueNotice";

describe("aviso de parcelas", () => {
  const day = "2026-11-10";
  const rows = [
    { amount: 500, due_date: day, status: "open" },
    { amount: 200, due_date: "2026-11-09", status: "open" },
    { amount: 100, due_date: "2026-11-08", status: "overdue" },
    { amount: 900, due_date: day, status: "paid" },
    { amount: 800, due_date: "2026-11-11", status: "open" },
  ];
  it("soma apenas parcelas não pagas que vencem hoje", () => {
    expect(summarizeDueInstallments(rows, day).today).toEqual({ count: 1, amount: 500 });
  });
  it("soma vencidas pela data mesmo sem status atualizado", () => {
    expect(summarizeDueInstallments(rows, day).overdue).toEqual({ count: 2, amount: 300 });
  });
  it("abre hoje com vencimento exato e sem parcelas pagas", () => {
    expect(duePeriod("today", day)).toEqual({ start: day, end: day, statuses: ["open", "overdue"] });
  });
  it("abre vencidas somente até ontem", () => {
    expect(duePeriod("overdue", day)).toEqual({ start: "", end: "2026-11-09", statuses: ["open", "overdue"] });
  });
  it("oculta somente no dia escolhido", () => {
    expect(isNoticeHidden(day, day)).toBe(true);
    expect(isNoticeHidden(day, "2026-11-11")).toBe(false);
    expect(isNoticeHidden(null, day)).toBe(false);
  });
  it("isola a preferência por clínica e usuário", () => {
    expect(noticeStorageKey("a", "u")).not.toBe(noticeStorageKey("a", "v"));
    expect(noticeStorageKey("a", "u")).not.toBe(noticeStorageKey("b", "u"));
  });
  it("considera o dia em São Paulo, não UTC", () => {
    expect(clinicToday(new Date("2026-11-11T01:00:00Z"))).toBe(day);
  });
});