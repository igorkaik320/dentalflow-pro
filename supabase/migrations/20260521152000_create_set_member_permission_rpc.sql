CREATE OR REPLACE FUNCTION public.set_clinic_member_permission(
  _clinic_id UUID,
  _member_id UUID,
  _module TEXT,
  _can_view BOOLEAN,
  _can_create BOOLEAN,
  _can_update BOOLEAN,
  _can_delete BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_clinic_role(_clinic_id, 'admin') THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.id = _member_id
      AND cm.clinic_id = _clinic_id
  ) THEN
    RAISE EXCEPTION 'member_not_found';
  END IF;

  IF _module NOT IN (
    'dashboard',
    'agenda',
    'registrations',
    'patrimony',
    'financial',
    'payable_installments',
    'settings',
    'security'
  ) THEN
    RAISE EXCEPTION 'invalid_module';
  END IF;

  INSERT INTO public.clinic_member_permissions (
    clinic_id,
    member_id,
    module,
    can_view,
    can_create,
    can_update,
    can_delete
  )
  VALUES (
    _clinic_id,
    _member_id,
    _module,
    _can_view,
    _can_create,
    _can_update,
    _can_delete
  )
  ON CONFLICT (member_id, module)
  DO UPDATE SET
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_clinic_member_permission(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clinic_member_permission(UUID, UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
