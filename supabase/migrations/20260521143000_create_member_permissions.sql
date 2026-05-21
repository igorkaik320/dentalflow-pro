CREATE TABLE IF NOT EXISTS public.clinic_member_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.clinic_members(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN (
    'dashboard',
    'agenda',
    'registrations',
    'patrimony',
    'financial',
    'payable_installments',
    'settings',
    'security'
  )),
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_update BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, module)
);

CREATE INDEX IF NOT EXISTS idx_clinic_member_permissions_clinic_member
ON public.clinic_member_permissions(clinic_id, member_id);

DROP TRIGGER IF EXISTS update_clinic_member_permissions_updated_at ON public.clinic_member_permissions;
CREATE TRIGGER update_clinic_member_permissions_updated_at
BEFORE UPDATE ON public.clinic_member_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clinic_member_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read clinic member permissions" ON public.clinic_member_permissions;
CREATE POLICY "Members can read clinic member permissions"
ON public.clinic_member_permissions
FOR SELECT TO authenticated
USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Admins can create clinic member permissions" ON public.clinic_member_permissions;
CREATE POLICY "Admins can create clinic member permissions"
ON public.clinic_member_permissions
FOR INSERT TO authenticated
WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

DROP POLICY IF EXISTS "Admins can update clinic member permissions" ON public.clinic_member_permissions;
CREATE POLICY "Admins can update clinic member permissions"
ON public.clinic_member_permissions
FOR UPDATE TO authenticated
USING (public.has_clinic_role(clinic_id, 'admin'))
WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

DROP POLICY IF EXISTS "Admins can delete clinic member permissions" ON public.clinic_member_permissions;
CREATE POLICY "Admins can delete clinic member permissions"
ON public.clinic_member_permissions
FOR DELETE TO authenticated
USING (public.has_clinic_role(clinic_id, 'admin'));
