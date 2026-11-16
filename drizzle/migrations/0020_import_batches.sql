ALTER TABLE public.receivables ADD COLUMN import_batch_id uuid;
CREATE INDEX receivables_import_batch_idx ON public.receivables(clinic_id, import_batch_id) WHERE import_batch_id IS NOT NULL;
UPDATE public.receivables r SET import_batch_id = b.bid FROM (SELECT clinic_id, import_filename, date_trunc('minute', created_at) m, gen_random_uuid() bid FROM public.receivables WHERE import_provider IS NOT NULL GROUP BY 1,2,3) b WHERE r.import_provider IS NOT NULL AND r.clinic_id=b.clinic_id AND r.import_filename IS NOT DISTINCT FROM b.import_filename AND date_trunc('minute', r.created_at)=b.m;
CREATE OR REPLACE FUNCTION public.import_pagbank_receivables(_clinic uuid,_company uuid,_account uuid,_patient uuid,_revenue uuid,_fee uuid,_filename text,_received date,_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.companies; a public.bank_accounts; p public.patients; rev public.financial_categories; fee public.financial_categories; x jsonb; cnt integer:=0; skipped integer:=0; n integer; gross numeric; tax numeric; interest numeric; addition numeric; sale date; receipt date; batch uuid:=gen_random_uuid();
BEGIN
IF auth.uid() IS NULL OR NOT public.commission_access(_clinic,'create') THEN RAISE EXCEPTION 'Sem autorização financeira para importar'; END IF;
SELECT * INTO c FROM public.companies WHERE id=_company AND clinic_id=_clinic AND active;
SELECT * INTO a FROM public.bank_accounts WHERE id=_account AND clinic_id=_clinic AND company_id=_company AND active;
SELECT * INTO p FROM public.patients WHERE id=_patient AND clinic_id=_clinic;
SELECT * INTO rev FROM public.financial_categories WHERE id=_revenue AND clinic_id=_clinic AND type='income';
SELECT * INTO fee FROM public.financial_categories WHERE id=_fee AND clinic_id=_clinic AND type='expense';
IF c.id IS NULL OR a.id IS NULL OR p.id IS NULL OR rev.id IS NULL OR fee.id IS NULL THEN RAISE EXCEPTION 'Confira empresa, conta, cliente e classes financeiras'; END IF;
IF jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Arquivo vazio ou acima de 2000 transações'; END IF;
FOR x IN SELECT value FROM jsonb_array_elements(_rows) LOOP
IF coalesce(x->>'transactionId','')='' THEN RAISE EXCEPTION 'Transação sem identificador'; END IF;
gross:=(x->>'gross')::numeric; tax:=(x->>'fee')::numeric; interest:=coalesce((x->>'interest')::numeric,0); addition:=coalesce((x->>'addition')::numeric,0); sale:=(x->>'date')::date; receipt:=coalesce(nullif(x->>'receivedDate','')::date,_received);
IF gross IS NULL OR tax IS NULL OR sale IS NULL OR gross<=0 OR tax<0 OR interest<0 OR addition<0 OR abs(gross+interest+addition-tax-(x->>'net')::numeric)>0.01 OR x->>'net' IS NULL OR receipt<sale THEN RAISE EXCEPTION 'Valores ou datas inconsistentes no arquivo'; END IF;
INSERT INTO public.receivables(clinic_id,company_id,company_name,patient_id,patient_name,procedure_name,amount,category,payment_method,installments,status,due_date,paid_date,sale_date,bank_account_id,interest_amount,addition_amount,machine_fee,fee_category,import_provider,import_transaction_id,import_nsu,machine_identifier,card_installments,import_filename,import_batch_id)
VALUES(_clinic,c.id,c.name,p.id,p.name,'Recebimento PagBank',gross,rev.name,x->>'method',1,CASE WHEN receipt IS NULL THEN 'open' ELSE 'paid' END,coalesce(receipt,sale),receipt,sale,a.id,interest,addition,tax,fee.name,'pagbank',upper(x->>'transactionId'),x->>'nsu',x->>'machine',coalesce((x->>'installments')::integer,1),_filename,batch)
ON CONFLICT (clinic_id,import_provider,import_transaction_id) WHERE import_transaction_id IS NOT NULL DO NOTHING;
GET DIAGNOSTICS n=ROW_COUNT; cnt:=cnt+n; skipped:=skipped+(1-n);
END LOOP;
RETURN jsonb_build_object('imported',cnt,'duplicates',skipped,'batch',batch);
END; $$;
CREATE OR REPLACE FUNCTION public.delete_import_batch(_clinic uuid,_batch uuid) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE n integer;
BEGIN
IF auth.uid() IS NULL OR NOT public.commission_access(_clinic,'delete') THEN RAISE EXCEPTION 'Sem autorização financeira para excluir'; END IF;
DELETE FROM public.receivable_items WHERE clinic_id=_clinic AND receivable_id IN (SELECT id FROM public.receivables WHERE clinic_id=_clinic AND import_batch_id=_batch);
DELETE FROM public.receivables WHERE clinic_id=_clinic AND import_batch_id=_batch;
GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.delete_import_batch(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_import_batch(uuid,uuid) TO authenticated,service_role;