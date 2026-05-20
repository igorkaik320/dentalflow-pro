INSERT INTO storage.buckets (id, name, public)
VALUES ('clinic-logos', 'clinic-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Clinic logo files can be read by path" ON storage.objects;
DROP POLICY IF EXISTS "Clinic logos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload clinic logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own clinic logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own clinic logos" ON storage.objects;
DROP POLICY IF EXISTS "Clinic members can upload clinic logos" ON storage.objects;
DROP POLICY IF EXISTS "Clinic members can update clinic logos" ON storage.objects;
DROP POLICY IF EXISTS "Clinic members can delete clinic logos" ON storage.objects;

CREATE POLICY "Clinic logos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'clinic-logos');

CREATE POLICY "Clinic members can upload clinic logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinic-logos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
);

CREATE POLICY "Clinic members can update clinic logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'clinic-logos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
)
WITH CHECK (
  bucket_id = 'clinic-logos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
);

CREATE POLICY "Clinic members can delete clinic logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'clinic-logos'
  AND EXISTS (
    SELECT 1
    FROM public.clinic_members cm
    WHERE cm.clinic_id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
      AND cm.active = true
  )
);
