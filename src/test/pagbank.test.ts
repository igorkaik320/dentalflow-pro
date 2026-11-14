import { describe, expect, it } from "vitest";
import { identifyAccount, parsePdfLines, parseSheet, readPagbank, validateRows } from "@/lib/pagbank";
import { receiptAmounts } from "@/lib/receipts";
describe("Recebimentos PagBank", () => {
  it("credita líquido e preserva bruto, juros, acréscimos e taxa", () => {
    expect(receiptAmounts({ amount: 100, interest_amount: 2, addition_amount: 3, machine_fee: 4 })).toEqual({ gross: 100, interest: 2, addition: 3, fee: 4, net: 101 });
  });
  it("lê venda do PDF sem inventar data de recebimento e sem multiplicar parcelas", () => {
    const rows = parsePdfLines(["C13B87EB-D190-4E3F-AB4D-D5B37F36E3D8", "31/10/2026 15:03 Pagbank - 630418514818 Crédito Visa Parcelado 12x Aprovada R$ 1.250,00 R$ 123,90 R$ 1.126,10"]);
    expect(rows[0]).toMatchObject({ gross: 1250, fee: 123.9, net: 1126.1, installments: 12, date: "2026-10-31", receivedDate: "" });
    expect(rows).toHaveLength(1);
    expect(validateRows([...rows,...rows])).toHaveLength(1);
  });
  it("não escolhe arbitrariamente entre contas PagBank", () => {
    expect(identifyAccount([{ id:"a",bank_name:"PAGBANK",account_number:"1" },{ id:"b",bank_name:"PAGBANK",account_number:"2" }], "Pagbank")).toBe("");
  });
  it("lê classes monetárias e recebimento informado em planilha", () => {
    expect(parseSheet([["Código da Transação", "Data da Transação", "Data de recebimento", "Valor bruto (R$)", "Taxa (R$)", "Valor líquido (R$)"], ["ABC", "13/11/2026", "14/11/2026", "100,00", "5,00", "95,00"]])[0]).toMatchObject({ transactionId:"ABC", gross:100,fee:5,net:95,receivedDate:"2026-11-14" });
  });
  it("rejeita bruto e líquido incompatíveis", () => {
    expect(() => parseSheet([["Código da Transação", "Data", "Bruto", "Taxa", "Líquido"], ["ABC", "13/11/2026", 100, 5, 100]])).toThrow();
  });
  it("preserva recebimentos antigos sem taxa informada", () => {
    expect(receiptAmounts({ amount: 182.47 }).net).toBe(182.47);
  });
  it("lê CSV UTF-8 com acentos e valores brasileiros", async () => {
    const content = new TextEncoder().encode("Código da Transação;Data;Bruto;Taxa;Líquido\nABC;14/11/2026;100,00;4,00;96,00");
    const file = { name: "pagbank.csv", size: content.byteLength, arrayBuffer: async () => content.buffer } as File;
    expect((await readPagbank(file)).rows[0]).toMatchObject({ gross:100,fee:4,net:96 });
  });
});