ALTER TABLE public.receivables ADD COLUMN interest_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (interest_amount>=0), ADD COLUMN addition_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (addition_amount>=0), ADD COLUMN machine_fee numeric(14,2) NOT NULL DEFAULT 0 CHECK (machine_fee>=0), ADD COLUMN fee_category text, ADD COLUMN net_amount numeric GENERATED ALWAYS AS (amount + interest_amount + addition_amount - machine_fee) STORED, ADD COLUMN import_provider text, ADD COLUMN import_transaction_id text, ADD COLUMN import_nsu text, ADD COLUMN machine_identifier text, ADD COLUMN card_installments integer NOT NULL DEFAULT 1 CHECK(card_installments>0), ADD COLUMN import_filename text;
CREATE UNIQUE INDEX receivables_import_unique ON public.receivables(clinic_id,import_provider,import_transaction_id) WHERE import_transaction_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.import_pagbank_receivables(_clinic uuid,_company uuid,_account uuid,_patient uuid,_revenue uuid,_fee uuid,_filename text,_received date,_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.companies; a public.bank_accounts; p public.patients; rev public.financial_categories; fee public.financial_categories; x jsonb; cnt integer:=0; skipped integer:=0; n integer; gross numeric; tax numeric; interest numeric; addition numeric; sale date; receipt date;
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
INSERT INTO public.receivables(clinic_id,company_id,company_name,patient_id,patient_name,procedure_name,amount,category,payment_method,installments,status,due_date,paid_date,sale_date,bank_account_id,interest_amount,addition_amount,machine_fee,fee_category,import_provider,import_transaction_id,import_nsu,machine_identifier,card_installments,import_filename)
VALUES(_clinic,c.id,c.name,p.id,p.name,'Recebimento PagBank',gross,rev.name,x->>'method',1,CASE WHEN receipt IS NULL THEN 'open' ELSE 'paid' END,coalesce(receipt,sale),receipt,sale,a.id,interest,addition,tax,fee.name,'pagbank',upper(x->>'transactionId'),x->>'nsu',x->>'machine',coalesce((x->>'installments')::integer,1),_filename)
ON CONFLICT (clinic_id,import_provider,import_transaction_id) WHERE import_transaction_id IS NOT NULL DO NOTHING;
GET DIAGNOSTICS n=ROW_COUNT; cnt:=cnt+n; skipped:=skipped+(1-n);
END LOOP;
RETURN jsonb_build_object('imported',cnt,'duplicates',skipped);
END; $$;
REVOKE ALL ON FUNCTION public.import_pagbank_receivables(uuid,uuid,uuid,uuid,uuid,uuid,text,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_pagbank_receivables(uuid,uuid,uuid,uuid,uuid,uuid,text,date,jsonb) TO authenticated,service_role;