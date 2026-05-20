ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS external_id UUID,
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS document TEXT,
  ADD COLUMN IF NOT EXISTS bank TEXT,
  ADD COLUMN IF NOT EXISTS agency TEXT,
  ADD COLUMN IF NOT EXISTS account TEXT,
  ADD COLUMN IF NOT EXISTS mobile TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_clinic_external_id_key'
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT suppliers_clinic_external_id_key UNIQUE (clinic_id, external_id);
  END IF;
END $$;

ALTER TABLE public.payables
  ADD COLUMN IF NOT EXISTS external_id UUID,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS first_due_date DATE,
  ADD COLUMN IF NOT EXISTS installments_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS company_id UUID,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS source_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payables_clinic_external_id_key'
  ) THEN
    ALTER TABLE public.payables
      ADD CONSTRAINT payables_clinic_external_id_key UNIQUE (clinic_id, external_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payable_installments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  payable_id UUID NOT NULL REFERENCES public.payables(id) ON DELETE CASCADE,
  external_id UUID,
  installment_number INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payable_id, installment_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payable_installments_clinic_external_id_key'
  ) THEN
    ALTER TABLE public.payable_installments
      ADD CONSTRAINT payable_installments_clinic_external_id_key UNIQUE (clinic_id, external_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payable_installments_clinic_due
ON public.payable_installments(clinic_id, due_date);

CREATE INDEX IF NOT EXISTS idx_payable_installments_payable
ON public.payable_installments(payable_id);

DROP TRIGGER IF EXISTS update_payable_installments_updated_at ON public.payable_installments;
CREATE TRIGGER update_payable_installments_updated_at
BEFORE UPDATE ON public.payable_installments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS log_payable_installments_changes ON public.payable_installments;
CREATE TRIGGER log_payable_installments_changes
AFTER INSERT OR UPDATE OR DELETE ON public.payable_installments
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

ALTER TABLE public.payable_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read payable installments" ON public.payable_installments;
CREATE POLICY "Members can read payable installments"
ON public.payable_installments
FOR SELECT TO authenticated
USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can create payable installments" ON public.payable_installments;
CREATE POLICY "Members can create payable installments"
ON public.payable_installments
FOR INSERT TO authenticated
WITH CHECK (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can update payable installments" ON public.payable_installments;
CREATE POLICY "Members can update payable installments"
ON public.payable_installments
FOR UPDATE TO authenticated
USING (public.is_clinic_member(clinic_id))
WITH CHECK (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can delete payable installments" ON public.payable_installments;
CREATE POLICY "Members can delete payable installments"
ON public.payable_installments
FOR DELETE TO authenticated
USING (public.is_clinic_member(clinic_id));
