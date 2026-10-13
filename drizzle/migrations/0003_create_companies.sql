CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  legal_name text,
  cnpj text,
  phone text,
  email text,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view companies" ON public.companies FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members update companies" ON public.companies FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members delete companies" ON public.companies FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER log_companies_changes AFTER INSERT OR UPDATE OR DELETE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_clinic_change();
ALTER TABLE public.receivables ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.receivables ADD COLUMN company_name text;