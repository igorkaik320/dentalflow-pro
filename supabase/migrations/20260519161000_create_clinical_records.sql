CREATE TABLE IF NOT EXISTS public.clinical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  professional_name TEXT,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  complaint TEXT,
  diagnosis TEXT,
  procedure_performed TEXT,
  prescription TEXT,
  observations TEXT,
  attachments TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_date
ON public.clinical_records(clinic_id, record_date DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_records_patient
ON public.clinical_records(patient_id);

DROP TRIGGER IF EXISTS update_clinical_records_updated_at ON public.clinical_records;
CREATE TRIGGER update_clinical_records_updated_at
BEFORE UPDATE ON public.clinical_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS log_clinical_records_changes ON public.clinical_records;
CREATE TRIGGER log_clinical_records_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clinical_records
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read clinical records" ON public.clinical_records;
CREATE POLICY "Members can read clinical records"
ON public.clinical_records
FOR SELECT
TO authenticated
USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can create clinical records" ON public.clinical_records;
CREATE POLICY "Members can create clinical records"
ON public.clinical_records
FOR INSERT
TO authenticated
WITH CHECK (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can update clinical records" ON public.clinical_records;
CREATE POLICY "Members can update clinical records"
ON public.clinical_records
FOR UPDATE
TO authenticated
USING (public.is_clinic_member(clinic_id))
WITH CHECK (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can delete clinical records" ON public.clinical_records;
CREATE POLICY "Members can delete clinical records"
ON public.clinical_records
FOR DELETE
TO authenticated
USING (public.is_clinic_member(clinic_id));
