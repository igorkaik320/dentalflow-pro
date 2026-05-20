CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  opened_by UUID,
  closed_by UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_clinic_opened
ON public.cash_sessions(clinic_id, opened_at DESC);

DROP TRIGGER IF EXISTS update_cash_sessions_updated_at ON public.cash_sessions;
CREATE TRIGGER update_cash_sessions_updated_at
BEFORE UPDATE ON public.cash_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS log_cash_sessions_changes ON public.cash_sessions;
CREATE TRIGGER log_cash_sessions_changes
AFTER INSERT OR UPDATE OR DELETE ON public.cash_sessions
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read cash sessions" ON public.cash_sessions;
CREATE POLICY "Members can read cash sessions"
ON public.cash_sessions
FOR SELECT
TO authenticated
USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can create cash sessions" ON public.cash_sessions;
CREATE POLICY "Members can create cash sessions"
ON public.cash_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can update cash sessions" ON public.cash_sessions;
CREATE POLICY "Members can update cash sessions"
ON public.cash_sessions
FOR UPDATE
TO authenticated
USING (public.is_clinic_member(clinic_id))
WITH CHECK (public.is_clinic_member(clinic_id));
