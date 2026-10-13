ALTER TABLE public.bank_accounts ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.procedures ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.cash_sessions ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id);
CREATE UNIQUE INDEX cash_sessions_open_per_account ON public.cash_sessions(bank_account_id) WHERE closed_at IS NULL AND bank_account_id IS NOT NULL;
CREATE TABLE public.cash_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL REFERENCES public.clinics(id),
 bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id), company_id uuid NOT NULL REFERENCES public.companies(id),
 type text NOT NULL CHECK(type IN ('income','expense')), description text NOT NULL,
 amount numeric(14,2) NOT NULL CHECK(amount > 0), movement_date date NOT NULL DEFAULT CURRENT_DATE,
 category text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_movements_member_select ON public.cash_movements FOR SELECT TO authenticated USING(public.is_clinic_member(clinic_id));
CREATE POLICY cash_movements_member_insert ON public.cash_movements FOR INSERT TO authenticated WITH CHECK(public.is_clinic_member(clinic_id));
CREATE POLICY cash_movements_member_update ON public.cash_movements FOR UPDATE TO authenticated USING(public.is_clinic_member(clinic_id)) WITH CHECK(public.is_clinic_member(clinic_id));
CREATE POLICY cash_movements_member_delete ON public.cash_movements FOR DELETE TO authenticated USING(public.is_clinic_member(clinic_id));
CREATE INDEX cash_movements_account_date ON public.cash_movements(bank_account_id,movement_date);
CREATE OR REPLACE FUNCTION public.validate_company_registration() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.company_id IS NULL THEN RAISE EXCEPTION 'Selecione a empresa'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND clinic_id=NEW.clinic_id) THEN RAISE EXCEPTION 'Empresa invalida'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_bank_account_company BEFORE INSERT OR UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.validate_company_registration();
CREATE TRIGGER validate_procedure_company BEFORE INSERT OR UPDATE ON public.procedures FOR EACH ROW EXECUTE FUNCTION public.validate_company_registration();
CREATE OR REPLACE FUNCTION public.validate_cash_account() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a public.bank_accounts%ROWTYPE;
BEGIN
 IF NEW.bank_account_id IS NULL THEN RAISE EXCEPTION 'Selecione o caixa'; END IF;
 SELECT * INTO a FROM public.bank_accounts WHERE id=NEW.bank_account_id AND clinic_id=NEW.clinic_id;
 IF a.id IS NULL OR a.account_type <> 'caixa' OR a.company_id IS NULL THEN RAISE EXCEPTION 'Conta de caixa invalida'; END IF;
 IF TG_TABLE_NAME='cash_movements' THEN
   IF NEW.company_id IS DISTINCT FROM a.company_id THEN RAISE EXCEPTION 'Empresa diferente do caixa'; END IF;
   IF NEW.movement_date < a.initial_date THEN RAISE EXCEPTION 'Data anterior ao saldo inicial'; END IF;
 END IF;
 IF TG_OP='INSERT' AND NOT a.active THEN RAISE EXCEPTION 'Caixa inativo'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_cash_movement BEFORE INSERT OR UPDATE ON public.cash_movements FOR EACH ROW EXECUTE FUNCTION public.validate_cash_account();
CREATE TRIGGER validate_cash_session BEFORE INSERT OR UPDATE OF bank_account_id ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_cash_account();
CREATE TRIGGER update_cash_movements_updated_at BEFORE UPDATE ON public.cash_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER log_cash_movements_changes AFTER INSERT OR UPDATE OR DELETE ON public.cash_movements FOR EACH ROW EXECUTE FUNCTION public.log_clinic_change();
COMMENT ON COLUMN public.bank_accounts.company_id IS 'Required for new and edited accounts; legacy accounts remain unassigned until edited.';
COMMENT ON COLUMN public.procedures.company_id IS 'Required for new and edited procedures; legacy procedures remain unassigned until edited.';
COMMENT ON COLUMN public.cash_sessions.bank_account_id IS 'New sessions are account-scoped; legacy unscoped sessions are retained as historical records.';