CREATE OR REPLACE FUNCTION public.preview_commissions(_clinic uuid, _company uuid, _month date, _basis text DEFAULT 'sales'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result jsonb; start_day date:=date_trunc('month',_month)::date; end_day date:=(date_trunc('month',_month)+interval '1 month')::date; _period text:=to_char(date_trunc('month',_month),'YYYY-MM');
BEGIN
IF NOT public.commission_access(_clinic,'view') THEN RAISE EXCEPTION 'Sem permissão para consultar comissões'; END IF;
IF _basis NOT IN ('sales','received') OR _month IS NULL THEN RAISE EXCEPTION 'Período ou base inválidos'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=_company AND clinic_id=_clinic) THEN RAISE EXCEPTION 'Empresa inválida'; END IF;
WITH events AS (
 SELECT r.id,r.seller_id AS person,r.patient_name AS patient,r.procedure_name AS procedure,r.quantity,r.amount,CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END AS event_date,'sale'::text AS kind,round(r.amount * COALESCE(s.commission_rate,0)/100,2) AS reward
 FROM public.receivables r JOIN public.suppliers s ON s.id=r.seller_id AND s.clinic_id=r.clinic_id AND s.is_collaborator
 WHERE r.clinic_id=_clinic AND r.company_id=_company AND (CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END)>=start_day AND (CASE WHEN _basis='received' THEN r.paid_date ELSE r.sale_date END)<end_day AND (_basis='sales' OR r.status='paid')
 UNION ALL
 SELECT r.id,r.executor_id,r.patient_name,r.procedure_name,r.quantity,r.amount,r.execution_date,'execution',
  CASE WHEN p.bonus_type='fixed' THEN round(COALESCE(p.bonus_value,0)*r.quantity,2)
       WHEN p.bonus_type IN ('percent','percentage') THEN round(r.amount*COALESCE(p.bonus_value,0)/100,2)
       ELSE 0 END
 FROM public.receivables r JOIN public.suppliers s ON s.id=r.executor_id AND s.clinic_id=r.clinic_id AND s.is_collaborator JOIN public.procedures p ON p.id=r.procedure_id AND p.clinic_id=r.clinic_id AND p.company_id=r.company_id
 WHERE r.clinic_id=_clinic AND r.company_id=_company AND r.execution_date>=start_day AND r.execution_date<end_day
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