import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency } from "@/lib/utils";
import { formatPaymentMethod, identifyAccount, normalize, readPagbank, resolvePagbankReceipts, type PagbankRow } from "@/lib/pagbank";

type Named = { id: string; name: string };
type Account = { id: string; company_id: string; bank_name: string; account_number: string };
export default function PagbankImportPage() {
  const { clinic, can } = useClinic();
  const fileInput = useRef<HTMLInputElement>(null);
  const [companies,setCompanies] = useState<Named[]>([]), [patients,setPatients] = useState<Named[]>([]), [accounts,setAccounts] = useState<Account[]>([]), [categories,setCategories] = useState<(Named & { type: string })[]>([]);
  const [company,setCompany] = useState(""), [account,setAccount] = useState(""), [patient,setPatient] = useState(""), [revenue,setRevenue] = useState(""), [fee,setFee] = useState("");
  const [rows,setRows] = useState<PagbankRow[]>([]), [filename,setFilename] = useState(""), [fileText,setFileText] = useState(""), [received,setReceived] = useState(""), [busy,setBusy] = useState(false), [confirm,setConfirm] = useState(false), [error,setError] = useState(""), [result,setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const available = accounts.filter(a=>a.company_id===company);
  const [useTransactionDate, setUseTransactionDate] = useState(true);
  const receiptRows = resolvePagbankReceipts(rows, useTransactionDate, received);
  useEffect(()=> {
    if (!clinic.id) return;
    void Promise.all([
      db.from("companies").select("id,name").eq("clinic_id",clinic.id).eq("active",true).order("name"),
      db.from("patients").select("id,name").eq("clinic_id",clinic.id).order("code"),
      db.from("bank_accounts").select("id,company_id,bank_name,account_number").eq("clinic_id",clinic.id).eq("active",true),
      db.from("financial_categories").select("id,name,type").eq("clinic_id",clinic.id),
    ]).then(([c,p,a,f])=> {
      if(c.error||p.error||a.error||f.error) { setError("Não foi possível carregar os cadastros."); return; }
      setCompanies(c.data||[]);setPatients(p.data||[]);setAccounts(a.data||[]);setCategories(f.data||[]);
      const generic = (p.data||[]).filter((x:Named)=>/generico|padrao/.test(normalize(x.name)));
      if(generic.length===1) setPatient(generic[0].id);
      else if (p.data?.length === 1) setPatient(p.data[0].id);
      setRevenue((f.data||[]).find((x:Named & {type:string})=>x.type==="income" && normalize(x.name)==="receitadeservicos")?.id||"");
      setFee((f.data||[]).find((x:Named & {type:string})=>x.type==="expense" && normalize(x.name)==="taxamaquininha")?.id||"");
    });
  },[clinic.id]);
  const loadFile = async (file?:File) => {
    if(!file) return;
    setBusy(true);setError("");setResult(null);setRows([]);setReceived("");
    try { const parsed=await readPagbank(file);setRows(parsed.rows);setFilename(file.name);setFileText(parsed.text);setAccount(identifyAccount(available,parsed.text)); }
    catch(e) {setError(e instanceof Error?e.message:"Não foi possível ler o arquivo.");}
    finally {setBusy(false);}
  };
  const totals=rows.reduce((t,r)=>({gross:t.gross+r.gross,fee:t.fee+r.fee,net:t.net+r.net}),{gross:0,fee:0,net:0});
  const importRows=async()=> {
    setConfirm(false);setBusy(true);setError("");
    try {
      const {data,error:e}=await db.rpc("import_pagbank_receivables",{_clinic:clinic.id,_company:company,_account:account,_patient:patient,_revenue:revenue,_fee:fee,_filename:filename,_received:null,_rows:receiptRows});
      if(e) throw e;
      setResult(data);setRows([]);toast.success(`${data.imported} transações importadas; ${data.duplicates} repetidas ignoradas.`);
      if (fileInput.current) fileInput.current.value = "";
    } catch(e) {setError(e instanceof Error?e.message:(e as {message?:string})?.message||"Não foi possível importar.");}
    finally {setBusy(false);}
  };
  const select=(label:string,value:string,onChange:(s:string)=>void,opts:Named[],disabled=false)=> <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{opts.map(o=><SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>;
  return <ClinicLayout title="Importação" subtitle="Recebimentos de cartão, Pix e outros arquivos">
    <div className="mb-5 flex items-center gap-2"><Checkbox id="pagbank-use-transaction-date" checked={useTransactionDate} disabled={busy} onCheckedChange={value=>setUseTransactionDate(value===true)}/><Label htmlFor="pagbank-use-transaction-date">Considerar data da transação como data de recebimento</Label></div>
    <div className="grid gap-4 border-b border-border pb-6 md:grid-cols-3">
      {select("Empresa",company,v=>{setCompany(v);setAccount(identifyAccount(accounts.filter(a=>a.company_id===v),fileText));setResult(null);},companies)}
      {select("Conta de destino",account,setAccount,available.map(a=>({id:a.id,name:`${a.bank_name} · ${a.account_number}`})),!company)}
      {select("Cliente padrão",patient,setPatient,patients)}
      {select("Classe da receita",revenue,setRevenue,categories.filter(c=>c.type==="income"))}
      {select("Classe da taxa",fee,setFee,categories.filter(c=>c.type==="expense"))}
      <div className="space-y-1.5"><Label htmlFor="pagbank-file">Arquivo de importação</Label><Input ref={fileInput} id="pagbank-file" type="file" accept=".pdf,.csv,.xlsx,.xls" disabled={busy||!company||!can("financial","create")} onChange={e=>void loadFile(e.target.files?.[0])}/></div>
    </div>
    {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {busy&&<p role="status" className="py-6 text-sm text-muted-foreground">Processando...</p>}
    {result&&<div role="status" className="flex items-center gap-2 py-6 text-success"><CheckCircle2 className="h-5 w-5"/>{result.imported} transações importadas · {result.duplicates} repetidas ignoradas</div>}
    {!!rows.length&&<>
      <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Bruto",totals.gross],["Taxa maquininha",totals.fee],["Líquido",totals.net]].map(([l,v])=><div key={String(l)} className="border-b border-border pb-3"><p className="text-sm text-muted-foreground">{l}</p><p className="text-xl font-semibold">{formatCurrency(Number(v))}</p></div>)}</div>
      <div className="mb-5 flex flex-wrap items-end gap-4">{!useTransactionDate&&<div className="space-y-1.5"><Label htmlFor="pagbank-received">Recebimento confirmado em (quando ausente no arquivo)</Label><Input id="pagbank-received" type="date" value={received} disabled={busy} onChange={e=>setReceived(e.target.value)}/></div>}<Button disabled={busy||!account||!patient||!revenue||!fee||!can("financial","create")} onClick={()=>setConfirm(true)}><Upload className="mr-2 h-4 w-4"/>Importar {rows.length} transações</Button></div>
      {receiptRows.some(r=>!r.receivedDate)&&<p className="mb-4 text-sm text-warning">Sem data de recebimento confirmada, as transações serão cadastradas em aberto, sem alterar o saldo.</p>}
      {!account&&<p className="mb-4 text-sm text-warning">Conta não identificada com segurança. Selecione a conta de destino.</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr>{["Venda","Recebimento","Transação / NSU","Forma / parcelas","Máquina","Bruto","Juros","Acréscimos","Taxa","Líquido"].map(h=><th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>{receiptRows.map(r=><tr key={r.transactionId} className="border-b border-border"><td className="p-3 whitespace-nowrap">{r.date.split("-").reverse().join("/")}</td><td className="p-3 whitespace-nowrap">{r.receivedDate.split("-").reverse().join("/")||"Em aberto"}</td><td className="p-3 text-xs">{r.transactionId}<br/>{r.nsu}</td><td className="p-3">{formatPaymentMethod(r.method, r.installments)}</td><td className="p-3">{r.machine||"—"}</td>{[r.gross,r.interest,r.addition,r.fee,r.net].map((v,i)=><td key={i} className="p-3 whitespace-nowrap text-right">{formatCurrency(v)}</td>)}</tr>)}</tbody></table></div>
    </>}
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Confirmar importação" description={`${rows.length} transações para ${companies.find(c=>c.id===company)?.name || ""}, conta ${available.find(a=>a.id===account)?.bank_name || ""}. Somente recebimentos com data confirmada serão baixados. Transações repetidas serão ignoradas.`} onConfirm={()=>void importRows()}/>
  </ClinicLayout>;
}