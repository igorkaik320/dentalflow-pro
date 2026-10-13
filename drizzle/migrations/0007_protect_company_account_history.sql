CREATE OR REPLACE FUNCTION public.protect_account_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.account_type IS DISTINCT FROM OLD.account_type THEN
  IF EXISTS(SELECT 1 FROM public.cash_movements WHERE bank_account_id=OLD.id) OR EXISTS(SELECT 1 FROM public.cash_sessions WHERE bank_account_id=OLD.id) OR EXISTS(SELECT 1 FROM public.receivables WHERE bank_account_id=OLD.id) OR EXISTS(SELECT 1 FROM public.payable_installments WHERE bank_account_id=OLD.id) THEN
   RAISE EXCEPTION 'Conta com historico: mantenha a empresa e o tipo';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER protect_bank_account_history BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.protect_account_history();
CREATE OR REPLACE FUNCTION public.validate_settlement_company() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE target_company uuid; account_company uuid; account_clinic uuid;
BEGIN
 IF NEW.bank_account_id IS NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='receivables' THEN target_company := NEW.company_id;
 ELSE SELECT company_id INTO target_company FROM public.payables WHERE id=NEW.payable_id AND clinic_id=NEW.clinic_id; END IF;
 SELECT company_id,clinic_id INTO account_company,account_clinic FROM public.bank_accounts WHERE id=NEW.bank_account_id;
 IF account_clinic IS DISTINCT FROM NEW.clinic_id OR account_company IS NULL OR target_company IS DISTINCT FROM account_company THEN RAISE EXCEPTION 'A conta e o lancamento devem pertencer a mesma empresa'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_receivable_settlement_company BEFORE INSERT OR UPDATE OF bank_account_id,company_id ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.validate_settlement_company();
CREATE TRIGGER validate_payable_installment_company BEFORE INSERT OR UPDATE OF bank_account_id,payable_id ON public.payable_installments FOR EACH ROW EXECUTE FUNCTION public.validate_settlement_company();