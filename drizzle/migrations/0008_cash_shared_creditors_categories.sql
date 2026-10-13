ALTER TABLE public.cash_movements ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL, ADD COLUMN supplier_name text, ADD COLUMN category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.validate_cash_entities() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.supplier_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.suppliers WHERE id=NEW.supplier_id AND clinic_id=NEW.clinic_id) THEN RAISE EXCEPTION 'Credor invalido'; END IF;
  SELECT name INTO NEW.supplier_name FROM public.suppliers WHERE id=NEW.supplier_id;
 END IF;
 IF NEW.category_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.financial_categories WHERE id=NEW.category_id AND clinic_id=NEW.clinic_id AND type=NEW.type) THEN RAISE EXCEPTION 'Categoria incompativel com o movimento'; END IF;
  SELECT name INTO NEW.category FROM public.financial_categories WHERE id=NEW.category_id;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_cash_entities BEFORE INSERT OR UPDATE OF supplier_id,category_id,type ON public.cash_movements FOR EACH ROW EXECUTE FUNCTION public.validate_cash_entities();