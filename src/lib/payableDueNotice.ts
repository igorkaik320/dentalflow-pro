export type DueGroup = "today" | "overdue";
export type DueInstallment = { amount: number | string; due_date: string; status: string };

export function clinicToday(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function duePeriod(group: DueGroup, day = clinicToday()) {
  const previous = new Date(`${day}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return { start: group === "today" ? day : "", end: group === "today" ? day : previous.toISOString().slice(0, 10), statuses: ["open", "overdue"] };
}

export function summarizeDueInstallments(rows: DueInstallment[], day = clinicToday()) {
  const result = { today: { count: 0, amount: 0 }, overdue: { count: 0, amount: 0 } };
  for (const row of rows) {
    if (!["open", "overdue"].includes(row.status) || !row.due_date || row.due_date > day) continue;
    const group = row.due_date === day ? "today" : "overdue";
    result[group].count += 1;
    result[group].amount += Math.round(Number(row.amount) * 100);
  }
  result.today.amount /= 100;
  result.overdue.amount /= 100;
  return result;
}

export function noticeStorageKey(clinicId: string, userId: string) {
  return `payable-due-notice:${clinicId}:${userId}`;
}

export function isNoticeHidden(hiddenDay: string | null, day = clinicToday()) {
  return hiddenDay === day;
}