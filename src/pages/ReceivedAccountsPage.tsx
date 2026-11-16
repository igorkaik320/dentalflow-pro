import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { FileSpreadsheet, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { ClinicLayout } from "@/components/ClinicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClinic } from "@/contexts/ClinicContext";
import { db } from "@/lib/clinicCloud";
import { formatCurrency } from "@/lib/utils";
import { formatPaymentMethod } from "@/lib/pagbank";
import { receiptAmounts, type ReceiptAmounts } from "@/lib/receipts";

type Named = {id:string;name:string};
type Row = ReceiptAmounts & {id:string;paid_date:string;patient_name:string;company_name:string;category:string;payment_method:string;card_installments:number;import_transaction_id:string;bank_account_id:string};
const br=(d:string)=>d.split("-").reverse().join("/");
export default function ReceivedAccountsPage() {
  const {clinic}=useClinic();
  const [companies,setCompanies]=useState<Named[]>([]),[accounts,setAccounts]=useState<(Named & {company_id:string})[]>([]),[categories,setCategories]=useState<Named[]>([]);
  const [f,setF]=useState({company:"all",account:"all",category:"all",start:`${new Date().toISOString().slice(0,7)}-01`,end:new Date().toISOString().slice(0,10)});
  const [applied,setApplied]=useState(f),[rows,setRows]=useState<Row[]|null>(null),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!clinic.id)return;void Promise.all([db.from("companies").select("id,name").eq("clinic_id",clinic.id),db.from("bank_accounts").select("id,company_id,bank_name,account_number").eq("clinic_id",clinic.id),db.from("financial_categories").select("id,name").eq("clinic_id",clinic.id).eq("type","income")]).then(([c,a,k])=>{if(c.error||a.error||k.error)return toast.error("Não foi possível carregar os filtros.");setCompanies(c.data||[]);setAccounts((a.data||[]).map((x:any)=>({...x,name:`${x.bank_name} · ${x.account_number}`})));setCategories(k.data||[]);});},[clinic.id]);
  const consult=async()=>{
    if(!f.start||!f.end||f.start>f.end)return toast.error("Confira o período de recebimento.");
    setBusy(true);
    let q=db.from("receivables").select("*").eq("clinic_id",clinic.id).eq("status","paid").gte("paid_date",f.start).lte("paid_date",f.end).order("paid_date");
    if(f.company!=="all")q=q.eq("company_id",f.company);
    if(f.account!=="all")q=q.eq("bank_account_id",f.account);
    if(f.category!=="all")q=q.eq("category",f.category);
    const {data,error}=await q;setBusy(false);
    if(error)return toast.error("Não foi possível consultar os recebimentos.");
    setRows(data||[]);setApplied({...f});
  };
  const totals=(rows||[]).reduce((t,r)=>{const a=receiptAmounts(r);return {gross:t.gross+a.gross,interest:t.interest+a.interest,addition:t.addition+a.addition,fee:t.fee+a.fee,net:t.net+a.net};},{gross:0,interest:0,addition:0,fee:0,net:0});
  const head=["Recebimento","Empresa","Cliente","Forma / parcelas","Classe financeira","Bruto","Juros","Acréscimos","Taxa","Líquido"];
  const values=(r:Row)=>{const a=receiptAmounts(r);return [br(r.paid_date),r.company_name,r.patient_name,formatPaymentMethod(r.payment_method,r.card_installments||1),r.category,...[a.gross,a.interest,a.addition,a.fee,a.net]];};
  const body=(r:Row)=>values(r).map((v,i)=>i>=5?formatCurrency(Number(v)):String(v||""));
  const title=`${clinic.name} · ${companies.find(c=>c.id===applied.company)?.name||"Todas as empresas"} · ${br(applied.start)} a ${br(applied.end)}`;
  const totalValues=[totals.gross,totals.interest,totals.addition,totals.fee,totals.net];
  const pdf=()=>{if(!rows)return;const doc=new jsPDF({orientation:"landscape"});doc.setFontSize(14);doc.text("Relatório de Contas Recebidas",14,15);doc.setFontSize(9);doc.text(title,14,21);autoTable(doc,{startY:26,styles:{fontSize:8},headStyles:{fillColor:[220,220,220],textColor:20},head:[head],body:rows.map(body),foot:[["Total","","","","",...totalValues.map(formatCurrency)]]});doc.save(`contas-recebidas-${applied.start}-${applied.end}.pdf`);};
  const excel=()=>{if(!rows)return;const ws=XLSX.utils.aoa_to_sheet([["Contas Recebidas"],[title],[],head,...rows.map(values),["Total","","","","",...totalValues]]);ws["!cols"]=head.map((_,i)=>({wch:i<5?25:16}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Contas Recebidas");XLSX.writeFile(wb,`contas-recebidas-${applied.start}-${applied.end}.xlsx`);};
  const sel=(label:string,value:string,change:(s:string)=>void,opts:Named[])=><div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={change}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{opts.map(o=><SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>;
  return <ClinicLayout title="Contas Recebidas" subtitle="Recebimentos por data de entrada">
    <form className="mb-6 grid gap-4 border-b border-border pb-6 md:grid-cols-3" onSubmit={e=>{e.preventDefault();void consult();}}>
      {sel("Empresa",f.company,v=>setF({...f,company:v,account:"all"}),companies)}
      {sel("Conta",f.account,v=>setF({...f,account:v}),accounts.filter(a=>f.company==="all"||a.company_id===f.company))}
      {sel("Classe financeira",f.category,v=>setF({...f,category:v}),categories.map(c=>({id:c.name,name:c.name})))}
      <div><Label htmlFor="received-start">Recebimento de</Label><Input id="received-start" type="date" value={f.start} onChange={e=>setF({...f,start:e.target.value})}/></div><div><Label htmlFor="received-end">Até</Label><Input id="received-end" type="date" value={f.end} onChange={e=>setF({...f,end:e.target.value})}/></div>
      <div className="flex flex-wrap items-end gap-2"><Button disabled={busy}><Search className="mr-2 h-4 w-4"/>{busy?"Consultando...":"Consultar"}</Button><Button type="button" variant="outline" disabled={!rows?.length} onClick={pdf}><FileText className="mr-2 h-4 w-4"/>PDF</Button><Button type="button" variant="outline" disabled={!rows?.length} onClick={excel}><FileSpreadsheet className="mr-2 h-4 w-4"/>Excel</Button></div>
    </form>
    {rows&&<><div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Valor bruto",totals.gross],["Taxa maquininha",totals.fee],["Valor líquido",totals.net]].map(([l,v])=><div key={String(l)} className="border-b border-border pb-3"><p className="text-sm text-muted-foreground">{l}</p><p className="text-xl font-semibold">{formatCurrency(Number(v))}</p></div>)}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr>{head.map(h=><th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id} className="border-b border-border">{body(r).map((v,i)=><td key={i} className={`p-3 ${i>=5?"text-right whitespace-nowrap":""}`}>{v}</td>)}</tr>):<tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhuma conta recebida no período.</td></tr>}</tbody><tfoot className="bg-muted font-semibold"><tr><td colSpan={5} className="p-3">Total</td>{totalValues.map((v,i)=><td key={i} className="p-3 text-right whitespace-nowrap">{formatCurrency(v)}</td>)}</tr></tfoot></table></div></>}
  </ClinicLayout>;
}