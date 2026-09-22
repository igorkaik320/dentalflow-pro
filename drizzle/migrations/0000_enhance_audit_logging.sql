CREATE OR REPLACE FUNCTION public.log_clinic_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_clinic UUID;
  target_id UUID;
  old_data JSONB;
  new_data JSONB;
  changed_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  target_clinic := COALESCE(NEW.clinic_id, OLD.clinic_id);
  target_id := COALESCE(NEW.id, OLD.id);
  old_data := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  new_data := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::TEXT[])
    INTO changed_columns
    FROM jsonb_object_keys(new_data) AS key
    WHERE key NOT IN ('updated_at')
      AND old_data->key IS DISTINCT FROM new_data->key;
  END IF;

  INSERT INTO public.activity_logs (clinic_id, user_id, table_name, action, record_id, details)
  VALUES (
    target_clinic,
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    target_id,
    jsonb_build_object(
      'at', now(),
      'operation', TG_OP,
      'changed_columns', changed_columns,
      'previous', old_data,
      'current', new_data
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

DROP POLICY IF EXISTS "Members can view activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view activity logs"
ON public.activity_logs
FOR SELECT TO authenticated
USING (public.has_clinic_role(clinic_id, 'admin'));

DROP TRIGGER IF EXISTS log_clinics_changes ON public.clinics;
CREATE TRIGGER log_clinics_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clinics
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

DROP TRIGGER IF EXISTS log_clinic_members_changes ON public.clinic_members;
CREATE TRIGGER log_clinic_members_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clinic_members
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

DROP TRIGGER IF EXISTS log_clinic_member_permissions_changes ON public.clinic_member_permissions;
CREATE TRIGGER log_clinic_member_permissions_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clinic_member_permissions
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

DROP TRIGGER IF EXISTS log_clinic_working_hours_changes ON public.clinic_working_hours;
CREATE TRIGGER log_clinic_working_hours_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clinic_working_hours
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();

DROP TRIGGER IF EXISTS log_payable_installments_changes ON public.payable_installments;
CREATE TRIGGER log_payable_installments_changes
AFTER INSERT OR UPDATE OR DELETE ON public.payable_installments
FOR EACH ROW
EXECUTE FUNCTION public.log_clinic_change();