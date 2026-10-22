CREATE TABLE public.commission_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
 period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
 kind text NOT NULL CHECK (kind IN ('bonus','advance','discount')),
 amount numeric NOT NULL CHECK (amount > 0),
 description text,
 created_by uuid DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_adjustments TO authenticated;
GRANT ALL ON public.commission_adjustments TO service_role;
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view adjustments" ON public.commission_adjustments FOR SELECT TO authenticated USING (public.commission_access(clinic_id,'view'));
CREATE POLICY "insert adjustments" ON public.commission_adjustments FOR INSERT TO authenticated WITH CHECK (public.commission_access(clinic_id,'create'));
CREATE POLICY "update adjustments" ON public.commission_adjustments FOR UPDATE TO authenticated USING (public.commission_access(clinic_id,'create')) WITH CHECK (public.commission_access(clinic_id,'create'));
CREATE POLICY "delete adjustments" ON public.commission_adjustments FOR DELETE TO authenticated USING (public.commission_access(clinic_id,'create'));
CREATE TRIGGER update_commission_adjustments_updated_at BEFORE UPDATE ON public.commission_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER log_commission_adjustments_changes AFTER INSERT OR UPDATE OR DELETE ON public.commission_adjustments FOR EACH ROW EXECUTE FUNCTION public.log_clinic_change();