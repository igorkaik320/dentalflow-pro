ALTER TABLE public.suppliers ADD COLUMN code bigint;
ALTER TABLE public.patients ADD COLUMN code bigint;
ALTER TABLE public.companies ADD COLUMN code bigint;
WITH numbered AS (SELECT id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at, id) AS code FROM public.suppliers) UPDATE public.suppliers s SET code=n.code FROM numbered n WHERE s.id=n.id;
WITH numbered AS (SELECT id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at, id) AS code FROM public.patients) UPDATE public.patients s SET code=n.code FROM numbered n WHERE s.id=n.id;
WITH numbered AS (SELECT id, row_number() OVER (PARTITION BY clinic_id ORDER BY created_at, id) AS code FROM public.companies) UPDATE public.companies s SET code=n.code FROM numbered n WHERE s.id=n.id;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_clinic_code_unique UNIQUE (clinic_id, code), ADD CONSTRAINT suppliers_code_positive CHECK (code > 0);
ALTER TABLE public.patients ADD CONSTRAINT patients_clinic_code_unique UNIQUE (clinic_id, code), ADD CONSTRAINT patients_code_positive CHECK (code > 0);
ALTER TABLE public.companies ADD CONSTRAINT companies_clinic_code_unique UNIQUE (clinic_id, code), ADD CONSTRAINT companies_code_positive CHECK (code > 0);
CREATE TABLE public.registration_code_counters (clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE, entity text NOT NULL CHECK (entity IN ('suppliers','patients','companies')), last_code bigint NOT NULL DEFAULT 0 CHECK(last_code >= 0), PRIMARY KEY (clinic_id, entity));
GRANT ALL ON public.registration_code_counters TO service_role;
ALTER TABLE public.registration_code_counters ENABLE ROW LEVEL SECURITY;
INSERT INTO public.registration_code_counters(clinic_id,entity,last_code) SELECT clinic_id,'suppliers',max(code) FROM public.suppliers GROUP BY clinic_id UNION ALL SELECT clinic_id,'patients',max(code) FROM public.patients GROUP BY clinic_id UNION ALL SELECT clinic_id,'companies',max(code) FROM public.companies GROUP BY clinic_id;
CREATE FUNCTION public.assign_registration_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF NEW.code IS DISTINCT FROM OLD.code OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id THEN RAISE EXCEPTION 'O código e a clínica do cadastro não podem ser alterados.'; END IF;
  RETURN NEW;
 END IF;
 INSERT INTO public.registration_code_counters(clinic_id,entity,last_code) VALUES (NEW.clinic_id,TG_TABLE_NAME,1) ON CONFLICT(clinic_id,entity) DO UPDATE SET last_code=public.registration_code_counters.last_code+1 RETURNING last_code INTO NEW.code;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_registration_code() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_suppliers_code BEFORE INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.assign_registration_code();
CREATE TRIGGER assign_patients_code BEFORE INSERT OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.assign_registration_code();
CREATE TRIGGER assign_companies_code BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.assign_registration_code();
COMMENT ON COLUMN public.suppliers.code IS 'Permanent clinic-scoped sequential registration code assigned by the database.';
COMMENT ON COLUMN public.patients.code IS 'Permanent clinic-scoped sequential registration code assigned by the database.';
COMMENT ON COLUMN public.companies.code IS 'Permanent clinic-scoped sequential registration code assigned by the database.';