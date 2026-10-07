CREATE OR REPLACE FUNCTION public.log_clinic_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_clinic uuid;
  target_id uuid;
  old_data jsonb;
  new_data jsonb;
  row_data jsonb;
  changed_columns text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN old_data := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN new_data := to_jsonb(NEW); END IF;
  row_data := COALESCE(new_data, old_data);
  target_id := (row_data->>'id')::uuid;
  target_clinic := CASE WHEN TG_TABLE_NAME = 'clinics' THEN target_id ELSE (row_data->>'clinic_id')::uuid END;
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[]) INTO changed_columns
    FROM jsonb_object_keys(new_data) AS keys(k)
    WHERE k <> 'updated_at' AND old_data->k IS DISTINCT FROM new_data->k;
  END IF;
  INSERT INTO public.activity_logs (clinic_id, user_id, table_name, action, record_id, details)
  VALUES (target_clinic, auth.uid(), TG_TABLE_NAME, TG_OP, target_id,
    jsonb_build_object('at', now(), 'operation', TG_OP, 'changed_columns', changed_columns, 'previous', old_data, 'current', new_data));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM anon, authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_clinic_role(clinic_id, 'admin'));
CREATE INDEX IF NOT EXISTS activity_logs_clinic_created_idx ON public.activity_logs (clinic_id, created_at DESC);