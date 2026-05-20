
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS external_id uuid,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS bank text,
  ADD COLUMN IF NOT EXISTS agency text,
  ADD COLUMN IF NOT EXISTS account text,
  ADD COLUMN IF NOT EXISTS mobile text;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_clinic_external_uk
  ON public.suppliers(clinic_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS external_id uuid,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS first_due_date date,
  ADD COLUMN IF NOT EXISTS installments_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS source_notes text;

CREATE UNIQUE INDEX IF NOT EXISTS payables_clinic_external_uk
  ON public.payables(clinic_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payable_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payable_id uuid NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  external_id uuid,
  installment_number integer NOT NULL DEFAULT 1,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid_date date,
  paid_amount numeric(12,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','overdue')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payable_installments_clinic_external_uk
  ON public.payable_installments(clinic_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payable_installments_payable_number_uk
  ON public.payable_installments(payable_id, installment_number);

ALTER TABLE public.payable_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read installments"
  ON public.payable_installments FOR SELECT TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can create installments"
  ON public.payable_installments FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can update installments"
  ON public.payable_installments FOR UPDATE TO authenticated
  USING (public.is_clinic_member(clinic_id))
  WITH CHECK (public.is_clinic_member(clinic_id));

CREATE POLICY "Members can delete installments"
  ON public.payable_installments FOR DELETE TO authenticated
  USING (public.is_clinic_member(clinic_id));

CREATE TRIGGER update_payable_installments_updated_at
  BEFORE UPDATE ON public.payable_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
