-- Run against the application database; all test data and audit events roll back.
BEGIN;
DO $$
DECLARE
  clinic uuid := '310d3829-d256-4906-a5c8-0faa7836c7e3';
  v_entity text;
  initial bigint;
  first_id uuid;
  second_id uuid;
  first_code bigint;
  second_code bigint;
  unchanged bigint;
  minimum bigint;
BEGIN
  FOREACH v_entity IN ARRAY ARRAY['suppliers', 'patients', 'companies'] LOOP
    EXECUTE format('SELECT min(code) FROM public.%I WHERE clinic_id=$1', v_entity) INTO minimum USING clinic;
    IF minimum IS NOT NULL AND minimum <> 1 THEN RAISE EXCEPTION '% must start at 1', v_entity; END IF;
    SELECT last_code INTO initial FROM public.registration_code_counters WHERE clinic_id=clinic AND registration_code_counters.entity=v_entity;
    initial := coalesce(initial,0);
    EXECUTE format('INSERT INTO public.%I(clinic_id,name) VALUES($1,$2) RETURNING id,code', v_entity) INTO first_id,first_code USING clinic,'Validação temporária de código';
    IF first_code <> initial+1 THEN RAISE EXCEPTION '% must continue automatically', v_entity; END IF;
    EXECUTE format('UPDATE public.%I SET name=$1 WHERE id=$2 RETURNING code', v_entity) INTO unchanged USING 'Validação editada',first_id;
    IF unchanged <> first_code THEN RAISE EXCEPTION '% code changed on edit',v_entity; END IF;
    EXECUTE format('DELETE FROM public.%I WHERE id=$1',v_entity) USING first_id;
    EXECUTE format('INSERT INTO public.%I(clinic_id,name) VALUES($1,$2) RETURNING id,code', v_entity) INTO second_id,second_code USING clinic,'Validação temporária seguinte';
    IF second_code <> first_code+1 THEN RAISE EXCEPTION '% reused a deleted code',v_entity; END IF;
    BEGIN
      EXECUTE format('UPDATE public.%I SET code=code+10 WHERE id=$1',v_entity) USING second_id;
      RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Code override was accepted';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
    END;
  END LOOP;
END $$;
ROLLBACK;