import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TARGET_COMPANY = 'VIRTUOSA';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeStatus(raw: string | null | undefined, dueDate: string | null): 'open' | 'paid' | 'overdue' {
  const s = (raw || '').toString().toLowerCase().trim();
  if (s === 'paga' || s === 'pago' || s === 'paid') return 'paid';
  if (dueDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dueDate);
    if (d < today) return 'overdue';
  }
  return 'open';
}

async function fetchAll(source: any, table: string, filter?: { col: string; val: any }) {
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let q = source.from(table).select('*').range(from, from + pageSize - 1);
    if (filter) q = q.eq(filter.col, filter.val);
    const { data, error } = await q;
    if (error) throw new Error(`Erro lendo ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SOURCE_URL = Deno.env.get('SOURCE_SUPABASE_URL');
    const SOURCE_KEY = Deno.env.get('SOURCE_SUPABASE_ANON_KEY');

    if (!SOURCE_URL || !SOURCE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing SOURCE_SUPABASE_URL or SOURCE_SUPABASE_ANON_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Auth user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub;

    // Resolve clinic
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: membership, error: memErr } = await admin
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', userId)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (memErr) throw memErr;
    let clinicId = membership?.clinic_id;
    if (!clinicId) {
      const { data: createdClinic } = await admin.from('clinics').select('id').eq('created_by', userId).limit(1).maybeSingle();
      clinicId = createdClinic?.id;
    }
    if (!clinicId) {
      return new Response(JSON.stringify({ error: 'Nenhuma clínica encontrada para o usuário' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Source
    const source = createClient(SOURCE_URL, SOURCE_KEY);

    // Read source data
    const fornecedores = await fetchAll(source, 'fornecedores');
    const contas = await fetchAll(source, 'contas_pagar', { col: 'empresa_nome', val: TARGET_COMPANY });
    const contaIds = new Set(contas.map((c) => c.id));
    const parcelasAll = await fetchAll(source, 'contas_pagar_parcelas');
    const parcelas = parcelasAll.filter((p) => contaIds.has(p.conta_pagar_id));

    // Upsert suppliers
    const suppliersPayload = fornecedores.map((f) => ({
      clinic_id: clinicId,
      external_id: f.id,
      name: f.nome_fornecedor || f.razao_social || 'Sem nome',
      legal_name: f.razao_social || null,
      document: f.cnpj_cpf || null,
      cnpj: f.cnpj_cpf || null,
      mobile: f.celular || null,
      phone: f.celular || null,
      bank: f.banco || null,
      agency: f.agencia || null,
      account: f.conta || null,
    }));

    let suppliersImported = 0;
    for (const batch of chunk(suppliersPayload, 500)) {
      const { error, count } = await admin
        .from('suppliers')
        .upsert(batch, { onConflict: 'clinic_id,external_id', count: 'exact' });
      if (error) throw new Error(`suppliers upsert: ${error.message}`);
      suppliersImported += count ?? batch.length;
    }

    // Lookup supplier internal IDs by external_id
    const extIds = fornecedores.map((f) => f.id);
    const supplierMap = new Map<string, string>();
    for (const batch of chunk(extIds, 500)) {
      const { data, error } = await admin
        .from('suppliers')
        .select('id, external_id')
        .eq('clinic_id', clinicId)
        .in('external_id', batch);
      if (error) throw error;
      for (const r of data || []) supplierMap.set(r.external_id, r.id);
    }

    // Upsert payables
    const payablesPayload = contas.map((c) => {
      const dueDate = c.data_primeiro_vencimento || c.data_emissao || new Date().toISOString().slice(0, 10);
      return {
        clinic_id: clinicId,
        external_id: c.id,
        amount: Number(c.valor_total) || 0,
        description: c.observacao || `Conta ${c.id}`,
        source_notes: c.observacao || null,
        issue_date: c.data_emissao || null,
        first_due_date: c.data_primeiro_vencimento || null,
        due_date: dueDate,
        installments_count: Number(c.quantidade_parcelas) || 1,
        company_id: c.empresa_id || null,
        company_name: c.empresa_nome || null,
        supplier_id: c.fornecedor_id ? supplierMap.get(c.fornecedor_id) ?? null : null,
        supplier: c.fornecedor_id && supplierMap.has(c.fornecedor_id)
          ? (fornecedores.find((f) => f.id === c.fornecedor_id)?.nome_fornecedor ?? 'Fornecedor')
          : (fornecedores.find((f) => f.id === c.fornecedor_id)?.nome_fornecedor ?? 'Fornecedor'),
        status: normalizeStatus(c.status, dueDate),
      };
    });

    let payablesImported = 0;
    for (const batch of chunk(payablesPayload, 500)) {
      const { error, count } = await admin
        .from('payables')
        .upsert(batch, { onConflict: 'clinic_id,external_id', count: 'exact' });
      if (error) throw new Error(`payables upsert: ${error.message}`);
      payablesImported += count ?? batch.length;
    }

    // Build payable_id map
    const payableExtIds = contas.map((c) => c.id);
    const payableMap = new Map<string, string>();
    for (const batch of chunk(payableExtIds, 500)) {
      const { data, error } = await admin
        .from('payables')
        .select('id, external_id')
        .eq('clinic_id', clinicId)
        .in('external_id', batch);
      if (error) throw error;
      for (const r of data || []) payableMap.set(r.external_id, r.id);
    }

    // Upsert installments
    const installmentsPayload = parcelas
      .filter((p) => payableMap.has(p.conta_pagar_id))
      .map((p) => ({
        clinic_id: clinicId,
        payable_id: payableMap.get(p.conta_pagar_id)!,
        external_id: p.id,
        installment_number: Number(p.numero_parcela) || 1,
        amount: Number(p.valor_parcela) || 0,
        due_date: p.data_vencimento,
        paid_date: p.data_pagamento || null,
        paid_amount: p.valor_pago != null ? Number(p.valor_pago) : null,
        notes: p.observacao || null,
        status: normalizeStatus(p.status, p.data_vencimento),
      }));

    let installmentsImported = 0;
    for (const batch of chunk(installmentsPayload, 500)) {
      const { error, count } = await admin
        .from('payable_installments')
        .upsert(batch, { onConflict: 'clinic_id,external_id', count: 'exact' });
      if (error) throw new Error(`installments upsert: ${error.message}`);
      installmentsImported += count ?? batch.length;
    }

    return new Response(
      JSON.stringify({
        suppliers_imported: suppliersImported,
        payables_imported: payablesImported,
        installments_imported: installmentsImported,
        clinic_id: clinicId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('import error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
