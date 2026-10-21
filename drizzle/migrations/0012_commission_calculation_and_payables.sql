ALTER TABLE public.receivables ADD COLUMN procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL, ADD COLUMN quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0), ADD COLUMN sale_date date NOT NULL DEFAULT CURRENT_DATE, ADD COLUMN execution_date date;
UPDATE public.receivables SET sale_date = created_at::date;
CREATE UNIQUE INDEX payables_commission_unique ON public.payables(clinic_id, company_id, supplier_id, commission_period) WHERE commission_period IS NOT NULL;
CREATE OR REPLACE FUNCTION public.commission_access(_clinic uuid, _action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT public.has_clinic_role(_clinic,'admin') OR EXISTS(SELECT 1 FROM public.clinic_members m LEFT JOIN public.clinic_member_permissions p ON p.member_id=m.id AND p.clinic_id=m.clinic_id AND p.module='financial' WHERE m.clinic_id=_clinic AND m.user_id=auth.uid() AND m.active AND CASE WHEN _action='create' THEN COALESCE(p.can_create,m.role='finance') ELSE COALESCE(p.can_view,m.role='finance') END);
$$;
REVOKE ALL ON FUNCTION public.commission_access(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commission_access(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_commission_receivable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
IF NEW.seller_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=NEW.seller_id AND clinic_id=NEW.clinic_id AND is_collaborator) THEN RAISE EXCEPTION 'Selecione um vendedor colaborador da clínica'; END IF;
IF NEW.executor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=NEW.executor_id AND clinic_id=NEW.clinic_id AND is_collaborator) THEN RAISE EXCEPTION 'Selecione um executor colaborador da clínica'; END IF;
IF NEW.procedure_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.procedures WHERE id=NEW.procedure_id AND clinic_id=NEW.clinic_id AND company_id=NEW.company_id) THEN RAISE EXCEPTION 'Procedimento deve pertencer à empresa do lançamento'; END IF;
IF NEW.execution_date IS NOT NULL AND (NEW.executor_id IS NULL OR NEW.procedure_id IS NULL) THEN RAISE EXCEPTION 'Informe procedimento e executor para registrar execução'; END IF;
RETURN NEW;
END; $$;
CREATE TRIGGER validate_commission_receivable BEFORE INSERT OR UPDATE OF seller_id,executor_id,procedure_id,company_id,execution_date ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.validate_commission_receivable();
CREATE OR REPLACE FUNCTION public.preview_commissions(_clinic uuid,_company uuid,_month date,_basis text DEFAULT 'sales') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; start_day date:=date_trunc('month',_month)::date; end_day date:=(date_trunc('month',_month)+interval '1 month')::date;
BEGIN
IF NOT public.commission_access(_clinic,'view') THEN RAISE EXCEPTION 'Sem permissão para consultar comissões'; END IF;
IF _basis NOT IN ('sales','received') OR _month IS NULL THEN RAISE EXCEPTION 'Período ou base inválidos'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND clinic_id=_clinic) THEN RAISE EXCEPTION 'Empresa inválida'; END IF;
WITH events AS (
 SELECT r.id,r.seller_id AS person,r.patient_name,r.procedure_name,r.quantity,r.amount,CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END AS event_date,'sale' AS kind,round(r.amount * COALESCE(s.commission_rate,0)/100,2) AS reward
 FROM public.receivables r JOIN public.suppliers s ON s.id=r.seller_id AND s.clinic_id=r.clinic_id AND s.is_collaborator
 WHERE r.clinic_id=_clinic AND r.company_id=_company AND (CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END)>=start_day AND (CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END)<end_day AND (_basis='sales' OR r.status='paid')
 UNION ALL
 SELECT r.id,r.executor_id,r.patient_name,r.procedure_name,r.quantity,r.amount,r.execution_date,'execution',CASE p.bonus_type WHEN 'fixed' THEN round(p.bonus_value*r.quantity,2) WHEN 'percentage' THEN round(r.amount*p.bonus_value/100,2) ELSE 0 END
 FROM public.receivables r JOIN public.suppliers s ON s.id=r.executor_id AND s.clinic_id=r.clinic_id AND s.is_collaborator JOIN public.procedures p ON p.id=r.procedure_id AND p.clinic_id=r.clinic_id AND p.company_id=r.company_id
 WHERE r.clinic_id=_clinic AND r.company_id=_company AND r.execution_date>=start_day AND r.execution_date<end_day
), summaries AS (
 SELECT s.id,s.code,s.name,sec.name AS sector,COALESCE(s.individual_goal,0) AS goal,COALESCE(s.commission_rate,0) AS rate,
 COALESCE(sum(e.amount) FILTER(WHERE e.kind='sale'),0) AS sold,COALESCE(sum(e.quantity) FILTER(WHERE e.kind='sale'),0) AS sold_quantity,
 COALESCE(sum(e.quantity) FILTER(WHERE e.kind='execution'),0) AS executed_quantity,COALESCE(sum(e.reward) FILTER(WHERE e.kind='sale'),0) AS commission,COALESCE(sum(e.reward) FILTER(WHERE e.kind='execution'),0) AS bonus,
 COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'patient',e.patient_name,'procedure',e.procedure_name,'quantity',e.quantity,'amount',e.amount,'date',e.event_date,'kind',e.kind,'reward',e.reward) ORDER BY e.event_date,e.id) FILTER(WHERE e.id IS NOT NULL),'[]'::jsonb) AS details,
 (SELECT p.id FROM public.payables p WHERE p.clinic_id=_clinic AND p.company_id=_company AND p.supplier_id=s.id AND p.commission_period=to_char(start_day,'YYYY-MM') LIMIT 1) AS payable_id
 FROM public.suppliers s LEFT JOIN public.sectors sec ON sec.id=s.sector_id AND sec.clinic_id=s.clinic_id LEFT JOIN events e ON e.person=s.id WHERE s.clinic_id=_clinic AND s.is_collaborator GROUP BY s.id,sec.name
)
SELECT COALESCE(jsonb_agg(to_jsonb(summaries) || jsonb_build_object('total',commission+bonus) ORDER BY name),'[]'::jsonb) INTO result FROM summaries;
RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.preview_commissions(uuid,uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_commissions(uuid,uuid,date,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.generate_commission_payables(_clinic uuid,_company uuid,_month date,_basis text,_due date,_category uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rows jsonb; item jsonb; category_name text; company_name_value text; payable_id uuid; generated integer:=0; period text:=to_char(_month,'YYYY-MM');
BEGIN
IF NOT public.commission_access(_clinic,'create') THEN RAISE EXCEPTION 'Sem permissão para gerar contas a pagar'; END IF;
IF _due IS NULL THEN RAISE EXCEPTION 'Informe o vencimento'; END IF;
SELECT name INTO category_name FROM public.financial_categories WHERE id=_category AND clinic_id=_clinic AND type='expense';
IF category_name IS NULL THEN RAISE EXCEPTION 'Selecione uma categoria de despesa'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_clinic::text||_company::text||period,0));
rows:=public.preview_commissions(_clinic,_company,_month,_basis);
SELECT name INTO company_name_value FROM public.companies WHERE id=_company AND clinic_id=_clinic;
FOR item IN SELECT value FROM jsonb_array_elements(rows) LOOP
 IF (item->>'total')::numeric>0 AND item->>'payable_id' IS NULL THEN
 INSERT INTO public.payables(clinic_id,company_id,company_name,supplier_id,supplier,description,category,amount,due_date,first_due_date,issue_date,installments_count,status,commission_period,source_notes)
 VALUES(_clinic,_company,company_name_value,(item->>'id')::uuid,item->>'name','Comissões '||period,category_name,(item->>'total')::numeric,_due,_due,current_date,1,'open',period,jsonb_build_object('basis',_basis,'calculation',item,'generated_by',auth.uid(),'generated_at',now())::text) RETURNING id INTO payable_id;
 INSERT INTO public.payable_installments(clinic_id,payable_id,installment_number,amount,due_date,status) VALUES(_clinic,payable_id,1,(item->>'total')::numeric,_due,'open');
 generated:=generated+1;
 END IF;
END LOOP;
RETURN generated;
END; $$;
REVOKE ALL ON FUNCTION public.generate_commission_payables(uuid,uuid,date,text,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_commission_payables(uuid,uuid,date,text,date,uuid) TO authenticated;