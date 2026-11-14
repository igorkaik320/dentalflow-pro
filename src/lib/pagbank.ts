import * as XLSX from "xlsx";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;
export type PagbankRow = { transactionId: string; nsu: string; date: string; receivedDate: string; method: string; installments: number; machine: string; gross: number; interest: number; addition: number; fee: number; net: number };
export function resolvePagbankReceipts(rows: PagbankRow[], useTransactionDate = true, receivedDate = ""): PagbankRow[] {
  return rows.map(row => ({ ...row, receivedDate: row.receivedDate || (useTransactionDate ? row.date : receivedDate) }));
}
export const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function money(value: unknown): number {
  if (typeof value === "number") return value;
  const s = String(value ?? "").replace(/R\$|\s/g, "");
  if (!s) return NaN;
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}
function date(value: unknown) {
  if (typeof value === "number") { const d = XLSX.SSF.parse_date_code(value); return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`; }
  const s = String(value ?? "");
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const result = br ? `${br[3]}-${br[2]}-${br[1]}` : s.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
  if (!result || new Date(`${result}T12:00:00Z`).toISOString().slice(0, 10) !== result) throw new Error("Data ausente ou inválida em uma transação.");
  return result;
}
export function validateRows(rows: PagbankRow[]) {
  if (!rows.length) throw new Error("Nenhuma transação aprovada reconhecida no arquivo.");
  if (rows.length > 2000) throw new Error("Importe até 2000 transações por arquivo.");
  for (const r of rows) {
    date(r.date);
    if (r.receivedDate && r.receivedDate < r.date) throw new Error("Recebimento anterior à venda.");
    if (!r.transactionId || ![r.gross, r.interest, r.addition, r.fee, r.net].every(Number.isFinite) || r.gross <= 0 || Math.min(r.interest,r.addition,r.fee,r.net) < 0 || Math.abs(r.gross+r.interest+r.addition-r.fee-r.net) > 0.011) throw new Error("Transação sem código ou com valores inconsistentes. Confira bruto, taxa e líquido.");
  }
  const unique = new Map<string, PagbankRow>();
  for (const r of rows) {
    const key = r.transactionId.toUpperCase();
    const old = unique.get(key);
    if (old && JSON.stringify(old) !== JSON.stringify(r)) throw new Error("Código repetido com valores diferentes no arquivo.");
    unique.set(key, r);
  }
  return [...unique.values()];
}
export function parsePdfLines(lines: string[]) {
  const rows: PagbankRow[] = [];
  let pending = "";
  for (const line of lines) {
    const id = line.match(/[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/i)?.[0];
    if (id) pending = id;
    if (!/^\s*\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(line)) continue;
    const code = pending; pending = "";
    if (!/\bAprovada\b/i.test(line)) continue;
    const amounts = [...line.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map(m => money(m[1]));
    if (amounts.length !== 3 || !code) throw new Error("O PDF tem uma linha que não pôde ser reconhecida com segurança.");
    const rest = line.replace(/^\s*\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+Pagbank\s+/i, "").replace(id || "___", "").trim();
    const method = rest.match(/(?:Crédito|Débito|Pix|Credito|Debito).*?(?=\s+Aprovada)/i)?.[0]?.trim() || "PagBank";
    rows.push({ transactionId: code, nsu: rest.match(/\b\d{5,}\b/)?.[0] || "", date: date(line), receivedDate: "", method, installments: Number(method.match(/(\d+)x/i)?.[1] || 1), machine: "", gross: amounts[0], interest: 0, addition: 0, fee: amounts[1], net: amounts[2] });
  }
  return validateRows(rows);
}
export function parseSheet(data: unknown[][]) {
  const aliases = {
    transactionId: ["codigodatransacao", "codigotransacao", "iddatransacao", "idtransacao", "transactionid"], nsu: ["codigonsu", "nsu"],
    date: ["datadatransacao", "datatransacao", "datadavenda", "data"], receivedDate: ["dataderecebimento", "datarecebimento", "datadeliberacao", "dataliberacao", "datadepagamento"],
    gross: ["valorbrutor", "valorbruto", "bruto"], fee: ["taxar", "taxa", "valordataxa", "taxas"], net: ["valorliquidor", "valorliquido", "liquido"],
    interest: ["juros", "valorjuros"], addition: ["acrescimos", "acrescimo"], method: ["tipodetransacao", "formadepagamento", "meiodepagamento"], machine: ["maquina", "terminal", "conta", "estabelecimento"], installments: ["parcelas", "quantidadedeparcelas"], status: ["status", "situacao"],
  };
  const index = data.findIndex(row => row.some(v => aliases.gross.includes(normalize(String(v)))) && row.some(v => aliases.transactionId.includes(normalize(String(v)))));
  if (index < 0) throw new Error("Colunas não reconhecidas. O arquivo deve informar código da transação, data, bruto, taxa e líquido.");
  const headers = data[index].map(v => normalize(String(v)));
  const get = (row: unknown[], k: keyof typeof aliases) => row[headers.findIndex(h => aliases[k].includes(h))];
  return validateRows(data.slice(index+1).filter(row => String(get(row,"transactionId") || "").trim()).filter(row => !get(row,"status") || /^(aprovada|aprovado|paga|pago|concluida)$/i.test(String(get(row,"status")).trim())).map(row => ({
    transactionId: String(get(row,"transactionId")).trim(), nsu: String(get(row,"nsu") || ""), date: date(get(row,"date")), receivedDate: get(row,"receivedDate") ? date(get(row,"receivedDate")) : "", method: String(get(row,"method") || "PagBank"), machine: String(get(row,"machine") || ""), installments: Number(get(row,"installments") || String(get(row,"method")).match(/(\d+)x/i)?.[1] || 1), gross: money(get(row,"gross")), fee: money(get(row,"fee")), net: money(get(row,"net")), interest: get(row,"interest") ? money(get(row,"interest")) : 0, addition: get(row,"addition") ? money(get(row,"addition")) : 0,
  })));
}
export async function readPagbank(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo acima de 20 MB.");
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const pdf = await getDocument({ data: buffer }).promise;
    const lines: string[] = [];
    try {
      for (let i=1; i<=pdf.numPages; i++) {
        const page = await pdf.getPage(i), text = await page.getTextContent();
        const groups = new Map<number, { x: number; text: string }[]>();
        const viewport = page.getViewport({ scale: 1 });
        for (const item of text.items) if ("str" in item) {
          const [x, screenY] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          const y = Math.round(screenY);
          const group = groups.get(y) || []; group.push({ x, text: item.str }); groups.set(y, group);
        }
        for (const [, items] of [...groups].sort(([a],[b]) => a-b)) lines.push(items.sort((a,b) => a.x-b.x).map(x=>x.text).join(" "));
      }
      return { rows: parsePdfLines(lines), text: lines.join("\n") };
    } finally { await pdf.destroy(); }
  }
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error("Selecione PDF, CSV ou Excel.");
  const csv = file.name.toLowerCase().endsWith(".csv");
  const wb = csv
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "array", raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Planilha vazia.");
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return { rows: parseSheet(data), text: data.map(r=>r.join(" ")).join("\n") };
}
export function identifyAccount(accounts: { id: string; bank_name: string; account_number: string }[], text: string) {
  const exact = accounts.filter(a => a.account_number.length >= 4 && text.includes(a.account_number));
  if (exact.length === 1) return exact[0].id;
  const pag = accounts.filter(a => normalize(a.bank_name).includes("pagbank") && normalize(text).includes("pagbank"));
  return pag.length === 1 ? pag[0].id : "";
}