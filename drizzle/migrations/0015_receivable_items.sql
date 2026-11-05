CREATE TABLE public.receivable_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES public.procedures(id),
  procedure_name text NOT NULL DEFAULT '',
  seller_id uuid REFERENCES public.suppliers(id),
  executor_id uuid REFERENCES public.suppliers(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  execution_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivable_items TO authenticated;
GRANT ALL ON public.receivable_items TO service_role;
ALTER TABLE public.receivable_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read receivable items" ON public.receivable_items FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members create receivable items" ON public.receivable_items FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members update receivable items" ON public.receivable_items FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id)) WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members delete receivable items" ON public.receivable_items FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE INDEX receivable_items_receivable_idx ON public.receivable_items(receivable_id);

CREATE OR REPLACE FUNCTION public.validate_receivable_item() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE rec record;
BEGIN
SELECT clinic_id, company_id INTO rec FROM public.receivables WHERE id=NEW.receivable_id;
IF rec.clinic_id IS DISTINCT FROM NEW.clinic_id THEN RAISE EXCEPTION 'Item inválido para a clínica'; END IF;
IF NEW.seller_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=NEW.seller_id AND clinic_id=NEW.clinic_id AND is_collaborator) THEN RAISE EXCEPTION 'Selecione um vendedor colaborador da clínica'; END IF;
IF NEW.executor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=NEW.executor_id AND clinic_id=NEW.clinic_id AND is_collaborator) THEN RAISE EXCEPTION 'Selecione um executor colaborador da clínica'; END IF;
IF NEW.procedure_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.procedures WHERE id=NEW.procedure_id AND clinic_id=NEW.clinic_id AND company_id IS NOT DISTINCT FROM rec.company_id) THEN RAISE EXCEPTION 'Procedimento não pertence à empresa'; END IF;
IF NEW.executor_id IS NULL OR NEW.procedure_id IS NULL THEN NEW.execution_date := NULL; END IF;
NEW.updated_at := now();
RETURN NEW;
END; $$;
CREATE TRIGGER validate_receivable_item BEFORE INSERT OR UPDATE ON public.receivable_items FOR EACH ROW EXECUTE FUNCTION public.validate_receivable_item();
CREATE TRIGGER log_receivable_items AFTER INSERT OR UPDATE OR DELETE ON public.receivable_items FOR EACH ROW EXECUTE FUNCTION public.log_clinic_change();

INSERT INTO public.receivable_items(clinic_id,receivable_id,procedure_id,procedure_name,seller_id,executor_id,quantity,amount,execution_date)
SELECT clinic_id,id,procedure_id,procedure_name,seller_id,executor_id,GREATEST(quantity,1),amount,execution_date FROM public.receivables;

CREATE OR REPLACE FUNCTION public.preview_commissions(_clinic uuid, _company uuid, _month date, _basis text DEFAULT 'sales'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result jsonb; start_day date:=date_trunc('month',_month)::date; end_day date:=(date_trunc('month',_month)+interval '1 month')::date; _period text:=to_char(date_trunc('month',_month),'YYYY-MM');
BEGIN
IF NOT public.commission_access(_clinic,'view') THEN RAISE EXCEPTION 'Sem permissão para consultar comissões'; END IF;
IF _basis NOT IN ('sales','received') OR _month IS NULL THEN RAISE EXCEPTION 'Período ou base inválidos'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND clinic_id=_clinic) THEN RAISE EXCEPTION 'Empresa inválida'; END IF;
WITH events AS (
 SELECT i.id,i.seller_id AS person,r.patient_name AS patient,i.procedure_name AS procedure,i.quantity,i.amount,CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END AS event_date,'sale'::text AS kind,round(i.amount * COALESCE(s.commission_rate,0)/100,2) AS reward
 FROM public.receivable_items i JOIN public.receivables r ON r.id=i.receivable_id JOIN public.suppliers s ON s.id=i.seller_id AND s.clinic_id=r.clinic_id AND s.is_collaborator
 WHERE r.clinic_id=_clinic AND r.company_id=_company AND (CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END)>=start_day AND (CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END)<end_day AND (_basis='sales' OR r.status='paid')
 UNION ALL
 SELECT i.id,i.executor_id,r.patient_name,i.procedure_name,i.quantity,i.amount,i.execution_date,'execution',
  CASE WHEN p.bonus_type='fixed' THEN round(COALESCE(p.bonus_value,0)*i.quantity,2)
       WHEN p.bonus_type IN ('percent','percentage') THEN round(i.amount*COALESCE(p.bonus_value,0)/100,2)
       ELSE 0 END
 FROM public.receivable_items i JOIN public.receivables r ON r.id=i.receivable_id JOIN public.suppliers s ON s.id=i.executor_id AND s.clinic_id=r.clinic_id AND s.is_collaborator JOIN public.procedures p ON p.id=i.procedure_id AND p.clinic_id=r.clinic_id AND p.company_id=r.company_id
 WHERE r.clinic_id=_clinic AND r.company_id=_company AND i.execution_date>=start_day AND i.execution_date<end_day
 UNION ALL
 SELECT a.id,a.supplier_id,COALESCE(a.description,''),CASE a.kind WHEN 'bonus' THEN 'Bônus extra' WHEN 'advance' THEN 'Adiantamento' ELSE 'Desconto' END,1,a.amount,start_day,a.kind,CASE WHEN a.kind='bonus' THEN a.amount ELSE -a.amount END
 FROM public.commission_adjustments a WHERE a.clinic_id=_clinic AND a.company_id=_company AND a.period=_period
), summaries AS (
 SELECT s.id,s.code,s.name,sec.name AS sector,COALESCE(s.individual_goal,0) AS goal,COALESCE(s.commission_rate,0) AS rate,
 COALESCE(sum(e.amount) FILTER(WHERE e.kind='sale'),0) AS sold,COALESCE(sum(e.quantity) FILTER(WHERE e.kind='sale'),0) AS sold_quantity,
 COALESCE(sum(e.quantity) FILTER(WHERE e.kind='execution'),0) AS executed_quantity,COALESCE(sum(e.reward) FILTER(WHERE e.kind='sale'),0) AS commission,COALESCE(sum(e.reward) FILTER(WHERE e.kind='execution'),0) AS bonus,
 COALESCE(sum(e.reward) FILTER(WHERE e.kind='bonus'),0) AS extra_bonus,COALESCE(sum(-e.reward) FILTER(WHERE e.kind IN ('advance','discount')),0) AS deductions,
 COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'patient',e.patient,'procedure',e.procedure,'quantity',e.quantity,'amount',e.amount,'date',e.event_date,'kind',e.kind,'reward',e.reward) ORDER BY e.event_date,e.id) FILTER(WHERE e.id IS NOT NULL),'[]'::jsonb) AS details,
 (SELECT p.id FROM public.payables p WHERE p.clinic_id=_clinic AND p.company_id=_company AND p.supplier_id=s.id AND p.commission_period=_period LIMIT 1) AS payable_id
 FROM public.suppliers s LEFT JOIN public.sectors sec ON sec.id=s.sector_id AND sec.clinic_id=s.clinic_id LEFT JOIN events e ON e.person=s.id WHERE s.clinic_id=_clinic AND s.is_collaborator GROUP BY s.id,sec.name
)
SELECT COALESCE(jsonb_agg(to_jsonb(summaries) || jsonb_build_object('total',commission+bonus+extra_bonus-deductions) ORDER BY name),'[]'::jsonb) INTO result FROM summaries;
RETURN result;
END; $function$;
COMMENT ON COLUMN public.receivables.seller_id IS 'DEPRECATED: per-item seller in receivable_items';
COMMENT ON COLUMN public.receivables.executor_id IS 'DEPRECATED: per-item executor in receivable_items';