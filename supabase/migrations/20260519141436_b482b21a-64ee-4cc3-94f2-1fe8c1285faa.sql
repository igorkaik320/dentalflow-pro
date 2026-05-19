DROP POLICY IF EXISTS "Clinic logos are publicly readable" ON storage.objects;
CREATE POLICY "Clinic logo files can be read by path"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'clinic-logos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND array_length(storage.foldername(name), 1) >= 2
);

REVOKE EXECUTE ON FUNCTION public.is_clinic_member(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_clinic_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_clinic_change() FROM PUBLIC, anon, authenticated;