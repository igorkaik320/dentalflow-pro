export type ReceiptAmounts = { amount: number; interest_amount?: number; addition_amount?: number; machine_fee?: number; net_amount?: number };
export function receiptAmounts(r: ReceiptAmounts) {
  const gross = Number(r.amount || 0), interest = Number(r.interest_amount || 0), addition = Number(r.addition_amount || 0), fee = Number(r.machine_fee || 0);
  return { gross, interest, addition, fee, net: Math.round((gross + interest + addition - fee) * 100) / 100 };
}