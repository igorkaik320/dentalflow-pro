-- Restrict only the two selected clinical-attachment mutation policies.
-- Leave upload, read access, and bucket visibility unchanged.
ALTER POLICY "Clinical attachments can be updated by authenticated users"
ON storage.objects
TO authenticated
USING (
  bucket_id = 'clinical-attachments'
  AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'clinical-attachments'
  AND owner_id = (SELECT auth.uid()::text)
);

ALTER POLICY "Clinical attachments can be deleted by authenticated users"
ON storage.objects
TO authenticated
USING (
  bucket_id = 'clinical-attachments'
  AND owner_id = (SELECT auth.uid()::text)
);
