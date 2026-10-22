-- Regression tests: the whole fixture and its audit events are rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.sub','928f303f-45d3-4705-8545-64019f899655',true);
DO $$
DECLARE
 clinic uuid:='310d3829-d256-4906-a5c8-0faa7836c7e3'; company uuid; person uuid; proc uuid; category uuid; sale uuid; result jsonb; row jsonb; generated integer;
BEGIN
 INSERT INTO public.companies(clinic_id,name) VALUES(clinic,'Teste transacional comissão') RETURNING id INTO company;
 INSERT INTO public.suppliers(clinic_id,name,is_collaborator,commission_rate,individual_goal) VALUES(clinic,'Teste transacional colaborador',true,10,1000) RETURNING id INTO person;
 INSERT INTO public.procedures(clinic_id,company_id,name,bonus_type,bonus_value) VALUES(clinic,company,'Teste transacional procedimento','fixed',20) RETURNING id INTO proc;
 INSERT INTO public.financial_categories(clinic_id,name,type) VALUES(clinic,'Teste transacional categoria','expense') RETURNING id INTO category;
 INSERT INTO public.receivables(clinic_id,company_id,patient_name,professional_name,procedure_name,procedure_id,seller_id,executor_id,quantity,amount,due_date,sale_date,execution_date,status)
 VALUES(clinic,company,'Teste','', 'Teste transacional procedimento',proc,person,person,3,1000,'2026-10-31','2026-10-05','2026-10-06','open') RETURNING id INTO sale;
 result:=public.preview_commissions(clinic,company,'2026-10-01','sales');
 SELECT value INTO row FROM jsonb_array_elements(result) WHERE value->>'id'=person::text;
 IF (row->>'sold')::numeric<>1000 OR (row->>'sold_quantity')::integer<>3 THEN RAISE EXCEPTION 'Sale amount/quantity mismatch'; END IF;
 IF (row->>'commission')::numeric<>100 THEN RAISE EXCEPTION '10 percent commission must be 100'; END IF;
 IF (row->>'bonus')::numeric<>60 THEN RAISE EXCEPTION 'Fixed bonus must be 20 times 3'; END IF;
 UPDATE public.procedures SET bonus_type='percent',bonus_value=5 WHERE id=proc;
 result:=public.preview_commissions(clinic,company,'2026-10-01','sales');
 SELECT value INTO row FROM jsonb_array_elements(result) WHERE value->>'id'=person::text;
 IF (row->>'bonus')::numeric<>50 THEN RAISE EXCEPTION 'Percentage bonus must not multiply total by quantity'; END IF;
 UPDATE public.receivables SET execution_date=null WHERE id=sale;
 result:=public.preview_commissions(clinic,company,'2026-10-01','received');
 SELECT value INTO row FROM jsonb_array_elements(result) WHERE value->>'id'=person::text;
 IF (row->>'total')::numeric<>0 THEN RAISE EXCEPTION 'Unpaid sale and unconfirmed execution must not earn received commission'; END IF;
 UPDATE public.receivables SET status='paid',paid_date='2026-11-02',execution_date='2026-10-06' WHERE id=sale;
 result:=public.preview_commissions(clinic,company,'2026-11-01','received');
 SELECT value INTO row FROM jsonb_array_elements(result) WHERE value->>'id'=person::text;
 IF (row->>'commission')::numeric<>100 OR (row->>'bonus')::numeric<>0 THEN RAISE EXCEPTION 'Receipt and execution dates must be independent'; END IF;
 INSERT INTO public.commission_adjustments(clinic_id,company_id,supplier_id,period,kind,amount) VALUES(clinic,company,person,'2026-10','bonus',30),(clinic,company,person,'2026-10','advance',20);
 result:=public.preview_commissions(clinic,company,'2026-10-01','sales');
 SELECT value INTO row FROM jsonb_array_elements(result) WHERE value->>'id'=person::text;
 IF (row->>'total')::numeric<>160 THEN RAISE EXCEPTION 'Manual bonus adds and advance subtracts: expected 160, got %',row->>'total'; END IF;
 generated:=public.generate_commission_payables(clinic,company,'2026-10-01','sales','2026-11-05',category);
 IF generated<>1 THEN RAISE EXCEPTION 'Expected one payable'; END IF;
 generated:=public.generate_commission_payables(clinic,company,'2026-10-01','received','2026-11-05',category);
 IF generated<>0 THEN RAISE EXCEPTION 'Same month/collaborator cannot generate twice even with a different basis'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.payables p JOIN public.payable_installments i ON i.payable_id=p.id WHERE p.company_id=company AND p.amount=160 AND i.amount=160 AND p.commission_period='2026-10') THEN RAISE EXCEPTION 'Payable and installment must match calculation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.activity_logs WHERE clinic_id=clinic AND user_id=auth.uid() AND table_name='payables' AND details->'current'->>'company_id'=company::text) THEN RAISE EXCEPTION 'Commission generation must record its actor'; END IF;
END $$;
ROLLBACK;