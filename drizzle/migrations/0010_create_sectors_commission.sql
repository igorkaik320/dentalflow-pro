CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  responsible_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  goal_amount numeric NOT NULL DEFAULT 0,
  goal_period text NOT NULL DEFAULT 'monthly' CHECK (goal_period IN ('monthly','biweekly','weekly','quarterly','yearly')),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view sectors" ON public.sectors FOR SELECT TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members insert sectors" ON public.sectors FOR INSERT TO authenticated WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members update sectors" ON public.sectors FOR UPDATE TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members delete sectors" ON public.sectors FOR DELETE TO authenticated USING (public.is_clinic_member(clinic_id));
CREATE TRIGGER update_sectors_updated_at BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER log_sectors_changes AFTER INSERT OR UPDATE OR DELETE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.log_clinic_change();

ALTER TABLE public.suppliers ADD COLUMN sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers ADD COLUMN job_title text;
ALTER TABLE public.suppliers ADD COLUMN pix_key text;
ALTER TABLE public.suppliers ADD COLUMN individual_goal numeric;
ALTER TABLE public.suppliers ADD COLUMN commission_rate numeric;