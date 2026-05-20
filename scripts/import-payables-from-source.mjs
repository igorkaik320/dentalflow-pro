import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "SOURCE_SUPABASE_URL",
  "SOURCE_SUPABASE_ANON_KEY",
  "TARGET_SUPABASE_URL",
  "TARGET_SUPABASE_SERVICE_ROLE_KEY",
  "TARGET_CLINIC_ID",
];

const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const source = createClient(process.env.SOURCE_SUPABASE_URL, process.env.SOURCE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const target = createClient(process.env.TARGET_SUPABASE_URL, process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const clinicId = process.env.TARGET_CLINIC_ID;

function normalizeStatus(status, dueDate) {
  if (status === "paga") return "paid";
  if (status === "aberta" && dueDate && dueDate < new Date().toISOString().slice(0, 10)) return "overdue";
  return "open";
}

function asNumber(value) {
  return value == null ? 0 : Number(value);
}

function nullable(value) {
  return value === undefined || value === "" ? null : value;
}

async function fetchAll(table, select = "*") {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await source
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function upsertSuppliers(sourceSuppliers) {
  const payload = sourceSuppliers.map((supplier) => ({
    clinic_id: clinicId,
    external_id: supplier.id,
    name: supplier.nome_fornecedor || supplier.razao_social || "Fornecedor sem nome",
    legal_name: nullable(supplier.razao_social),
    cnpj: nullable(supplier.cnpj_cpf),
    document: nullable(supplier.cnpj_cpf),
    phone: nullable(supplier.celular),
    mobile: nullable(supplier.celular),
    email: null,
    category: null,
    notes: null,
    bank: nullable(supplier.banco),
    agency: nullable(supplier.agencia),
    account: nullable(supplier.conta),
    created_at: supplier.created_at || undefined,
    updated_at: supplier.updated_at || undefined,
  }));

  const { error } = await target
    .from("suppliers")
    .upsert(payload, { onConflict: "clinic_id,external_id" });
  if (error) throw new Error(`Failed to upsert suppliers: ${error.message}`);
}

async function supplierIdByExternalId() {
  const { data, error } = await target
    .from("suppliers")
    .select("id, external_id")
    .eq("clinic_id", clinicId)
    .not("external_id", "is", null);
  if (error) throw new Error(`Failed to map suppliers: ${error.message}`);
  return new Map((data || []).map((row) => [row.external_id, row.id]));
}

async function upsertPayables(sourcePayables, supplierMap) {
  const payload = sourcePayables.map((payable) => ({
    clinic_id: clinicId,
    external_id: payable.id,
    supplier_id: supplierMap.get(payable.fornecedor_id) || null,
    supplier: payable.fornecedor_nome || "Fornecedor não informado",
    description: payable.observacao || payable.fornecedor_nome || "Conta a pagar importada",
    category: null,
    amount: asNumber(payable.valor_total),
    status: normalizeStatus(payable.status, payable.data_primeiro_vencimento),
    due_date: payable.data_primeiro_vencimento || payable.data_emissao || new Date().toISOString().slice(0, 10),
    paid_date: null,
    issue_date: nullable(payable.data_emissao),
    first_due_date: nullable(payable.data_primeiro_vencimento),
    installments_count: Number(payable.quantidade_parcelas || 1),
    company_id: nullable(payable.empresa_id),
    company_name: nullable(payable.empresa_nome),
    source_notes: nullable(payable.observacao),
    created_at: payable.created_at || undefined,
    updated_at: payable.updated_at || undefined,
  }));

  const { error } = await target
    .from("payables")
    .upsert(payload, { onConflict: "clinic_id,external_id" });
  if (error) throw new Error(`Failed to upsert payables: ${error.message}`);
}

async function payableIdByExternalId() {
  const { data, error } = await target
    .from("payables")
    .select("id, external_id")
    .eq("clinic_id", clinicId)
    .not("external_id", "is", null);
  if (error) throw new Error(`Failed to map payables: ${error.message}`);
  return new Map((data || []).map((row) => [row.external_id, row.id]));
}

async function upsertInstallments(sourceInstallments, payableMap) {
  const payload = sourceInstallments
    .filter((installment) => payableMap.has(installment.conta_pagar_id))
    .map((installment) => ({
      clinic_id: clinicId,
      payable_id: payableMap.get(installment.conta_pagar_id),
      external_id: installment.id,
      installment_number: Number(installment.numero_parcela || 1),
      amount: asNumber(installment.valor_parcela),
      due_date: installment.data_vencimento,
      paid_date: nullable(installment.data_pagamento),
      paid_amount: installment.valor_pago == null ? null : asNumber(installment.valor_pago),
      status: normalizeStatus(installment.status, installment.data_vencimento),
      notes: nullable(installment.observacao),
      created_at: installment.created_at || undefined,
      updated_at: installment.updated_at || undefined,
    }));

  const { error } = await target
    .from("payable_installments")
    .upsert(payload, { onConflict: "clinic_id,external_id" });
  if (error) throw new Error(`Failed to upsert installments: ${error.message}`);
}

async function main() {
  console.log("Reading source data...");
  const [suppliers, payables, installments] = await Promise.all([
    fetchAll("fornecedores"),
    fetchAll("contas_pagar", "*"),
    fetchAll("contas_pagar_parcelas"),
  ]);

  const virtuousPayables = payables.filter((payable) => payable.empresa_nome === "VIRTUOSA");
  const payableExternalIds = new Set(virtuousPayables.map((payable) => payable.id));
  const virtuousSuppliers = suppliers;
  const virtuousInstallments = installments.filter((installment) => payableExternalIds.has(installment.conta_pagar_id));

  console.log(`Importing ${virtuousSuppliers.length} suppliers, ${virtuousPayables.length} payables, ${virtuousInstallments.length} installments.`);

  await upsertSuppliers(virtuousSuppliers);
  const suppliersMap = await supplierIdByExternalId();
  await upsertPayables(virtuousPayables, suppliersMap);
  const payablesMap = await payableIdByExternalId();
  await upsertInstallments(virtuousInstallments, payablesMap);

  console.log("Import finished.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
