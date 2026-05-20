GRANT EXECUTE ON FUNCTION public.is_clinic_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_clinic_role(UUID, public.app_role) TO authenticated;
